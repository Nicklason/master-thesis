import tls from "node:tls";
import { Message } from "../messages/message";
import { MessageFactory } from "../messages/factory";
import { getSubjectFromCert } from "../utils";
import { EventEmitter } from "node:events";
import { MessagePublisher, MessageSubscriber, Peer } from "./pubsub";

export declare interface NodeServer {
  on(event: "connected", listener: (id: number) => void): void;
  on(event: "disconnected", listener: (id: number) => void): void;
  on(event: "message", listener: (source: number, raw: Buffer) => void): void;
}

export class NodeServer implements Peer, MessagePublisher, MessageSubscriber {
  private readonly eventEmitter: EventEmitter = new EventEmitter();

  private readonly host: string;
  private readonly port: number;
  private readonly cert: Buffer;
  private readonly key: Buffer;
  private readonly ca: Buffer;

  private id: number | null = null;

  private readonly clients: Map<tls.TLSSocket, number> = new Map();
  private readonly server: tls.Server;

  constructor(
    host: string,
    port: number,
    cert: Buffer,
    key: Buffer,
    ca: Buffer,
  ) {
    this.host = host;
    this.port = port;
    this.cert = cert;
    this.key = key;
    this.ca = ca;

    const subject = getSubjectFromCert(this.cert);
    this.id = parseInt(subject.CN!);

    this.server = tls.createServer({
      cert: this.cert,
      key: this.key,
      ca: this.ca,
      requestCert: true,
      rejectUnauthorized: true,
    });
  }

  getId(): number | null {
    return this.id;
  }

  private handleNewClient(socket: tls.TLSSocket): void {
    const id = NodeServer.getClientId(socket);
    if (id === undefined) {
      console.error("Invalid ID");
      this.disconnect(socket);
      return;
    }

    this.eventEmitter.emit("connected", id);
    this.addClient(socket);

    this.publish(MessageFactory.serverHello(id));

    socket.on("data", (data) => {
      this.handleData(socket, data);
    });

    socket.on("error", () => {
      // Ignore error
    });

    socket.on("close", () => {
      this.eventEmitter.emit("disconnected", id);
      this.removeClient(socket);
    });
  }

  publish(message: Message): Promise<void> {
    const encoded = message.encode();

    // Go through all clients
    for (const [socket, id] of this.clients) {
      if (id === message.source) {
        continue;
      }

      if (!message.isBroadcast() && !message.isDestination(id)) {
        // Skip if not a broadcast message and if the client is not a destinations
        continue;
      }

      socket.write(encoded);
    }

    return Promise.resolve();
  }

  private addClient(socket: tls.TLSSocket): void {
    const id = NodeServer.getClientId(socket);
    if (id === undefined) {
      return;
    }

    this.clients.set(socket, id);
  }

  private removeClient(socket: tls.TLSSocket): void {
    this.clients.delete(socket);
  }

  private static getClientId(socket: tls.TLSSocket): number | undefined {
    const cert = socket.getPeerCertificate();

    const id = parseInt(cert.subject.CN);
    if (isNaN(id)) {
      return undefined;
    }

    return id;
  }

  listen(): void {
    this.server.listen(this.port, this.host);

    this.server.on("secureConnection", (socket) => {
      this.handleNewClient(socket);
    });
  }

  private handleData(socket: tls.TLSSocket, data: Buffer): void {
    const id = this.clients.get(socket);

    this.eventEmitter.emit("message", id, data);
  }

  private disconnect(socket: tls.TLSSocket): void {
    // TODO: Disconnect with reason?
    socket.destroy();
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  removeAllListeners(event?: string): void {
    this.eventEmitter.removeAllListeners(event);
  }
}
