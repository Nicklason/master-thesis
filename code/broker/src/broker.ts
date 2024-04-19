import { MessageType, Message } from "./messages/message";
import { MessageFactory } from "./messages/factory";
import { MessageRecorder } from "./messages/recorder";
import { NodeClient } from "./node/client";
import { NodeServer } from "./node/server";
import { getSubjectFromCert } from "./utils";
import fs from "node:fs";
import path from "node:path";
import { measureLatency } from "./ping";

interface PeerConfiguration {
  host: string;
  port: number;
}

/*
 * A message broker
 *
 * This class is responsible for managing connections and routing messages
 * to listening brokers.
 */
export class Broker {
  private readonly key: Buffer;
  private readonly cert: Buffer;
  private readonly ca: Buffer;

  private readonly server: NodeServer;
  private readonly clients: NodeClient[] = [];
  private readonly messageRecorder = new MessageRecorder();

  private readonly dir = process.env.DATA_DIR ?? "/app/data";

  private readonly id: number;

  constructor() {
    const { key, cert, ca } = this.getCertificates();

    this.key = key;
    this.cert = cert;
    this.ca = ca;

    this.id = parseInt(getSubjectFromCert(this.cert).CN!);

    this.server = new NodeServer("0.0.0.0", 8000, this.cert, this.key, this.ca);

    MessageFactory.setSource(this.id);

    const peerConfigs = this.getPeerConfigurations();

    // Connect to remote servers
    for (const config of peerConfigs) {
      this.createClient(config.host, config.port);
    }
  }

  private getCertificates(): { key: Buffer; cert: Buffer; ca: Buffer } {
    const key = fs.readFileSync(path.join(this.dir, "/key.pem"));
    const cert = fs.readFileSync(path.join(this.dir, "/cert.pem"));
    const ca = fs.readFileSync(path.join(this.dir, "/ca-cert.pem"));

    return { key, cert, ca };
  }

  private getPeerConfigurations(): PeerConfiguration[] {
    // Read local configuration file
    const raw = fs
      .readFileSync(path.join(this.dir, "/peers.json"))
      .toString("utf8");

    const configurations = JSON.parse(raw);

    return configurations;
  }

  getId(): number {
    return this.id;
  }

  private createClient(host: string, port: number): NodeClient {
    const client = new NodeClient(host, port, this.cert, this.key, this.ca);

    this.clients.push(client);

    return client;
  }

  async start(): Promise<void> {
    // Setup listeners

    this.server.on("connected", (id) => {
      console.log("Client connected with ID", id);
    });

    this.server.on("disconnected", (id) => {
      console.log("Client disconnected with ID", id);
    });

    this.server.on("message", (source, raw) => {
      this.handleMessage(source, raw);
    });

    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];

      client.on("message", (raw) => {
        this.handleMessage(client.getId()!, raw);
      });

      setInterval(() => {
        if (!client.hasConnected()) {
          return;
        }

        measureLatency(client, this.server)
          .then((latency) => {
            console.log("Latency to " + client.getTheirId() + ": " + latency);
          })
          .catch((err) => {
            console.error(err);
          });
      }, 1000).unref();
    }

    // Listen for incoming connections and messages
    this.server.listen();

    // Connect to remote servers
    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];
      await client.connect();
    }
  }

  private handleMessage(source: number, raw: Buffer) {
    const message = Message.decode(raw);

    if (this.messageRecorder.has(message.id)) {
      return;
    }

    // TODO: Maybe implement a message log?
    console.log("Message from " + source, message);
    this.messageRecorder.add(message);

    const type = message.type;

    if (type === MessageType.PING) {
      // Respond with pong
      const pong = MessageFactory.pong(message.id, message.source);

      const client = this.getClientByID(source);
      if (!client) {
        return;
      }

      client.publish(pong);
    }

    // TODO: Queue messages for delivery and save it to disk
    if (!message.isBroadcast()) {
      const destination = message.destinations[0];

      const client = this.getClientByID(destination);
      if (!client) {
        return;
      }

      client.publish(message);
    } else {
      this.broadcast(message);
    }
  }

  private getClientByID(id: number): NodeClient | undefined {
    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];

      if (client.hasConnected() && client.getId() === id) {
        return client;
      }
    }

    return undefined;
  }

  async broadcast(message: Message): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];

      promises.push(client.publish(message));
    }

    await Promise.all(promises);
  }

  async stop(): Promise<void> {
    // Remove listeners
    await this.server.close();
    this.server.removeAllListeners();

    for (const client of this.clients) {
      // Disconnect from remote servers
      await client.close();
      client.removeAllListeners();
    }
  }
}
