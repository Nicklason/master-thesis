import tls from "node:tls";
import { Message } from "../messages/message";
import { MessageFactory } from "../messages/factory";
import { EventEmitter } from "node:events";
import { MessagePublisher, MessageSubscriber, Peer } from "./pubsub";
import { Logger } from "../logger";

export declare interface NodeClient {
  on(event: "connected", listener: () => void): void;
  on(event: "disconnected", listener: () => void): void;
  on(event: "message", listener: (raw: Buffer) => void): void;
}

export class NodeClient implements Peer, MessagePublisher, MessageSubscriber {
  private readonly logger = new Logger(NodeClient.name);
  private readonly eventEmitter: EventEmitter = new EventEmitter();

  private readonly host: string;
  private readonly port: number;
  private readonly cert: Buffer;
  private readonly key: Buffer;
  private readonly ca: Buffer;

  // The TCP client with TLS
  private client: tls.TLSSocket | null = null;
  // Indicates whether we are connected to the peer
  private connected = false;
  // Indicates whether we have ever been connected to the peer
  private hasBeenConnected = false;
  // The id of the node we connect to. Set when the connection is established
  private id: number | null = null;
  // A queue of messages to send to the node
  private readonly buffer: Buffer[] = [];
  // Make sure we only have one connection attempt at a time
  private connectPromise: Promise<void> | null = null;
  // Make sure we only have one flush at a time
  private flushPromise: Promise<void> | null = null;
  // Indicate if the connection has been closed
  private closed = false;

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
  }

  getId(): number | null {
    return this.id;
  }

  isConnected(): boolean {
    return this.connected;
  }

  hasConnected(): boolean {
    return this.hasBeenConnected !== null;
  }

  getHost(): string {
    return this.host;
  }

  getPort(): number {
    return this.port;
  }

  isClosed(): boolean {
    return this.closed;
  }

  connect(reconnect = false): Promise<void> {
    if (this.connectPromise !== null) {
      // If we are already connecting, return the existing promise
      return this.connectPromise;
    }

    if (reconnect === false && this.connected) {
      return Promise.resolve();
    }

    this.closed = false;

    const options: tls.ConnectionOptions = {
      host: this.host,
      port: this.port,
      cert: this.cert,
      key: this.key,
      ca: this.ca,
      rejectUnauthorized: true,
      requestCert: true,
    };

    let attempts = 0;

    const promise = new Promise<void>((resolve, reject) => {
      const connect = () => {
        attempts++;

        if (this.client) {
          this.logger.debug("Cleaning up existing client");
          this.client.removeAllListeners();
          this.client.destroy();
        }

        this.client = tls.connect(options);

        this.logger.info(
          `Connecting to ${this.host}:${this.port} (attempt #${attempts})`,
        );

        this.client.setNoDelay(true);

        this.client.on("end", () => {
          this.handleDisconnected();
        });

        this.client.on("error", (err) => {
          this.handleDisconnected(err);

          // Max wait of 1 minute between attempts
          const wait =
            Math.min(
              1 * 60 * 1000,
              // Exponential backoff with a random factor to prevent the "thundering herd" problem
              1000 * Math.pow(2, attempts - 1),
            ) + Math.floor(Math.random() * 1000);

          this.logger.warn(`Connection failed, reconnecting in ${wait}ms...`);

          // Attempt to reconnect
          setTimeout(() => {
            connect();
          }, wait);
        });

        this.client.on("data", (data) => {
          // We only know that the connection works when we receive data
          attempts = 0;

          this.handleConnected();

          resolve();

          this.handleData(data);
        });

        this.client.on("secureConnect", () => {
          const cert = this.client!.getPeerCertificate();

          if (cert.subject.CN === undefined) {
            return reject(new Error("No common name in certificate"));
          }

          const id = parseInt(cert.subject.CN, 10);
          if (isNaN(id)) {
            return reject(new Error("Invalid node id"));
          }

          this.logger.setMeta("node", id);

          this.id = id;
        });
      };

      connect();
    })
      .catch((err) => {
        this.client?.destroy();
        this.client = null;

        throw err;
      })
      .finally(() => {
        this.connectPromise = null;
      });

    this.connectPromise = promise;

    return promise;
  }

  async close(): Promise<void> {
    return this.flush().then(() => {
      this.closed = true;
      return this.disconnect();
    });
  }

  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client === null) {
        return resolve();
      }

      this.client.end(() => {
        this.handleDisconnected();
        resolve();
      });
    });
  }

  private handleConnected(): void {
    if (this.connected) {
      return;
    }

    this.logger.info("Connection is ready");

    this.connected = true;
    this.hasBeenConnected = true;

    this.eventEmitter.emit("connected");

    this.publish(MessageFactory.clientHello(this.getId()!));
  }

  private handleDisconnected(err?: Error & { code?: string }): void {
    if (this.connected === false) {
      return;
    }

    let extra = "";
    if (err) {
      extra = `, reason: ${err.code ?? err.message}`;
    }

    this.logger.warn(`Disconnected from node${extra}`);

    this.connected = false;

    if (this.client) {
      this.client.removeAllListeners();
      this.client.destroy();
    }

    this.client = null;

    this.eventEmitter.emit("disconnected");
  }

  private handleData(data: Buffer): void {
    this.eventEmitter.emit("message", data);
  }

  publish(message: Message): Promise<void> {
    return this.publishEncoded(message.encode());
  }

  private publishEncoded(raw: Buffer): Promise<void> {
    if (this.closed && this.buffer.length === 0) {
      return Promise.reject(
        new Error("Connection is closed, no more messages can be sent"),
      );
    }

    // Buffer the write
    this.buffer.push(raw);
    // Attempt to flush the buffer
    return this.flush();
  }

  private write(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.client === null || this.connected === false) {
        return reject(new Error("Not connected"));
      }

      this.client.write(data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async flush(): Promise<void> {
    if (this.flushPromise !== null) {
      return this.flushPromise;
    }

    if (this.closed) {
      return;
    }

    this.flushPromise = new Promise<void>(async (resolve) => {
      while (this.buffer.length > 0) {
        try {
          // Wait for the connection to be established
          await this.connect();
          // Write the message
          await this.write(this.buffer[0]);
          // Remove the message from the queue
          this.buffer.shift();
        } catch (err) {
          this.logger.error("Error while flushing message buffer", err);
        }
      }

      resolve();
    }).finally(() => {
      this.flushPromise = null;
    });

    return this.flushPromise;
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
