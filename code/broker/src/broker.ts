import { Messages } from "./messages/implementations/message";
import { MessageType, LinkState } from "./messages/types";
import { MessageFactory } from "./messages/factory";
import { MessageRecorder } from "./messages/recorder";
import { NodeClient } from "./node/client";
import { NodeServer } from "./node/server";
import { getAltNamesFromCert, getSubjectFromCert } from "./utils";
import fs from "node:fs";
import path from "node:path";
import { Topology } from "./topology";
import { Logger } from "./logger";
import { SelectiveMessage } from "./messages/implementations/selective-message";

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
  private readonly logger = new Logger(Broker.name);

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

    this.topology = Topology.fromFile(
      path.join(this.dir, "/topology.json"),
      this.id,
    );

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

      try {
        const configurations = JSON.parse(raw);
        return configurations;
      } catch (e) {
        this.logger.error("Error parsing peers.json", e);
        return [];
      }
  }

  getId(): number {
    return this.id;
  }

  private createClient(host: string, port: number): NodeClient {
    const client = new NodeClient(host, port, this.cert, this.key, this.ca);

    this.clients.push(client);

    client.on("message", (raw) => {
      this.handleRaw(raw);
    });

    client.on("connected", () => {
      this.publish(
        MessageFactory.nodeConnect(
          client.getId()!,
          client.getHost(),
          client.getPort(),
        ),
      );
    });

    client.on("disconnected", () => {
      this.publish(MessageFactory.nodeDisconnect(client.getId()!));
    });

    return client;
  }

  async start(): Promise<void> {
    // Setup listeners

    this.server.on("connected", (id, socket) => {
      const altNames = getAltNamesFromCert(socket.getPeerX509Certificate()!);

      const address = altNames[0].address;

      // Hardcoded port and address for now
      this.publish(MessageFactory.nodeConnect(id, address, 8000));
    });

    this.server.on("disconnected", (id) => {
      this.publish(MessageFactory.nodeDisconnect(id));
    });

    this.server.on("message", (_, raw) => {
      this.handleRaw(raw);
    });

    // Listen for incoming connections and messages
    this.server.listen();

    // Connect to remote servers
    await Promise.all(this.clients.map((client) => client.connect()));
  }

  getPeers() {
    return this.clients.map((client) => ({
      id: client.getId(),
      host: client.getHost(),
      port: client.getPort(),
      connected: client.isConnected(),
    }));
  }

  async addPeer(host: string, port: number): Promise<void> {
    // Only create a new client if it doesn't exist
    if (this.getPeerByHostAndPort(host, port)) {
      return;
    }

    const client = this.createClient(host, port);

    this.savePeers();

    return client.connect();
  }

  private getPeerByHostAndPort(
    host: string,
    port: number,
  ): NodeClient | undefined {
    return this.clients.find(
      (client) => client.getHost() === host && client.getPort() === port,
    );
  }

  removePeerById(id: number): Promise<void> {
    const client = this.clients.find((client) => client.getId() === id);
    if (!client) {
      return Promise.resolve();
    }

    return this.removePeer(client);
  }

  async removePeerByHostAndPort(host: string, port: number): Promise<void> {
    const client = this.getPeerByHostAndPort(host, port);
    if (!client) {
      return Promise.resolve();
    }

    return this.removePeer(client);
  }

  private async removePeer(client: NodeClient) {
    await client.close();
    client.removeAllListeners();

    this.clients.splice(this.clients.indexOf(client), 1);
    this.savePeers();
  }

  private handleRaw(raw: Buffer) {
    const message = new SelectiveMessage(raw) as Messages;
    this.handleMessage(message);
  }

  private handleMessage(message: Messages) {
    if (this.messageRecorder.has(message.id)) {
      return;
    }

    // TODO: Maybe implement a message log?
    this.messageRecorder.add(message);

    if (message.isDestination(this.id)) {
      if (message.type === MessageType.PING) {
        // Respond with pong
        const pong = MessageFactory.pong(message.id, message.source);
        this.publish(pong);
      } else if (message.type === MessageType.CLIENT_HELLO) {
        // Respond with entire topology
        const topology = MessageFactory.topology(this.topology.export());
        topology.setDestinations([message.source]);
        this.publish(topology.build());
      } else if (
        message.type === MessageType.NODE_CONNECT ||
        message.type === MessageType.NODE_DISCONNECT
      ) {
        this.topology.addLinkChange({
          state:
            message.type === MessageType.NODE_CONNECT
              ? LinkState.UP
              : LinkState.DOWN,
          source: message.source,
          target: message.payload.node_id,
          timestamp: message.timestamp,
        });
      } else if (
        message.type === MessageType.TOPOLOGY &&
        message.source !== this.id
      ) {
        this.logger.debug(`Received topology from ${message.source}`);
        // Update topology with the received topology
        const topology = message.payload;
        topology.nodes.forEach((node) => this.topology.addNode(node));
        topology.edges.forEach((edge) => this.topology.addLinkChange(edge));
      } else if (message.type === MessageType.DATA) {
        console.log(
          "Received data message from " +
            message.source +
            " with payload: " +
            message.payload.topic +
            " " +
            message.payload.value +
            " (" +
            message.payload.value.toString("utf8") +
            ")",
        );
      }

      // TODO: Might have to better support removing destinations from a message
      // If it is not a broadcast message and we then remove a destination then
      // it may "turn into" a broadcast message, which is not what we want

      // Not a broadcast message, we may remove ourselves from the destinations
      if (!message.isBroadcast()) {
        // Remove self from destinations
        message.removeDestination(this.id);
        // Check if message has any destinations left
        if (message.destinations.length === 0) {
          // Message has no more destinations, stop routing
          return;
        }
      }
    }

    if (message.source === this.id) {
      return;
    }

    // TODO: Queue messages for delivery and save it to disk
    this.publish(message);
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

    if (message.isBroadcast()) {
      await this.broadcast(message);
    } else {
      // Get next hop
      const next = message.destinations
        .map((destination) =>
          this.topology.getNextHop(this.getId(), destination),
        )
        .filter((id): id is number => id !== undefined);

      // Remove duplicates
      const unique = new Set(next);
      for (const id of unique) {
        const client = this.getClientByID(id);
        // Make sure client is not closed. Should not happen, but just in case
        if (client && !client.isClosed()) {
          await client.publish(message);
        }
      }
    }
  }

  private async broadcast(message: Messages): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];
      if (client.isClosed()) {
        continue;
      }

      promises.push(client.publish(message));
    }

    await Promise.all(promises);
  }

  async stop(): Promise<void> {
    // Save peers
    this.savePeers();

    // Remove listeners
    await this.server.close();
    this.server.removeAllListeners();

    for (let i = this.clients.length - 1; i >= 0; i--) {
      const client = this.clients[i];

      // Disconnect from remote servers
      await client.close();
      client.removeAllListeners();
      // Remove the client
      this.clients.splice(i, 1);
    }

    // Save topology
    this.topology.saveToFile(path.join(this.dir, "/topology.json"));
  }

  private savePeers(): void {
    const peers: PeerConfiguration[] = [];

    for (let i = 0; i < this.clients.length; i++) {
      const client = this.clients[i];

      peers.push({
        host: client.getHost(),
        port: client.getPort(),
      });
    }

    fs.writeFileSync(
      path.join(this.dir, "/peers.json"),
      JSON.stringify(peers, null, 2),
    );
  }
}
