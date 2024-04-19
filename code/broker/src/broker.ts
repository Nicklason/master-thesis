import { MessageType, Message, Messages } from "./messages/message";
import { MessageFactory } from "./messages/factory";
import { MessageRecorder } from "./messages/recorder";
import { NodeClient } from "./node/client";
import { NodeServer } from "./node/server";
import { getAltNamesFromCert, getSubjectFromCert } from "./utils";
import fs from "node:fs";
import path from "node:path";
import { Topology } from "./topology";

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
  private readonly topology: Topology;
  private readonly dir = process.env.DATA_DIR ?? "/app/data";

  private readonly id: number;

  constructor() {
    const { key, cert, ca } = this.getCertificates();

    this.key = key;
    this.cert = cert;
    this.ca = ca;

    this.id = parseInt(getSubjectFromCert(this.cert).CN!);

    this.topology = Topology.fromFile(path.join(this.dir, "/topology.json"), this.id);

    this.server = new NodeServer("0.0.0.0", 8000, this.cert, this.key, this.ca);

    MessageFactory.setSource(this.id);

    const peerConfigs = this.getPeerConfigurations();

    // Connect to remote servers
    for (const config of peerConfigs) {
      this.createClient(config.host, config.port);
    }

    setInterval(() => {
      this.topology.saveToFile(path.join(this.dir, "/topology.json"));
    }, 10000).unref();
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

    this.server.on("connected", (id, socket) => {
      const altNames = getAltNamesFromCert(socket.getPeerX509Certificate()!);

      const address = altNames[0].address;

      // Hardcoded port and address for now
      this.broadcast(MessageFactory.nodeConnect(id, address, 8000));
    });

    this.server.on("disconnected", (id) => {
      this.broadcast(MessageFactory.nodeDisconnect(id));
    });

    this.server.on("message", (_, raw) => {
      this.handleRaw(raw);
    });

    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];

      client.on("message", (raw) => {
        this.handleRaw(raw);
      });

      client.on("connected", () => {
        this.broadcast(
          MessageFactory.nodeConnect(
            client.getId()!,
            client.getHost(),
            client.getPort(),
          ),
        );
      });

      client.on("disconnected", () => {
        this.broadcast(MessageFactory.nodeDisconnect(client.getId()!));
      });
    }

    // Listen for incoming connections and messages
    this.server.listen();

    // Connect to remote servers
    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];
      await client.connect();
    }
  }

  private handleRaw(raw: Buffer) {
    const message = Message.decode(raw);
    this.handleMessage(message);
  }

  private handleMessage(message: Messages) {
    if (this.messageRecorder.has(message.id)) {
      return;
    }

    // TODO: Maybe implement a message log?
    this.messageRecorder.add(message);

    // Update topology
    this.topology.addNode(message.source);
    if (
      message.type === MessageType.NODE_CONNECT ||
      message.type === MessageType.NODE_DISCONNECT
    ) {
      this.topology.addLinkChange({
        state: message.type === MessageType.NODE_CONNECT ? "up" : "down",
        source: message.source,
        target: message.payload.node_id,
        // We know that timestamps are generated from numbers, just cast it
        timestamp: message.timestamp.toNumber(),
      });
    }

    if (message.isDestination(this.id)) {
      if (message.type === MessageType.PING) {
        // Respond with pong
        const pong = MessageFactory.pong(message.id, message.source);

        this.publish(pong);
      }
    }

    // TODO: Queue messages for delivery and save it to disk
    if (!message.isBroadcast()) {
      const destination = message.destinations[0];

      const client = this.getClientByID(destination);
      if (!client) {
        return;
      }

      this.publish(message);
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

  async publish(message: Messages): Promise<void> {
    // Handle the message locally first, then publish it
    this.handleMessage(message);
    this.messageRecorder.add(message);

    // TODO: Route the message to the correct client

    // For now, just broadcast the message
    await this.broadcast(message);
  }

  async broadcast(message: Messages): Promise<void> {
    this.handleMessage(message);
    this.messageRecorder.add(message);

    const promises: Promise<void>[] = [];

    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];

      promises.push(client.publish(message));
    }

    await Promise.all(promises);
  }

  async stop(): Promise<void> {
    // Save topology
    this.topology.saveToFile(path.join(this.dir, "/topology.json"));

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
