import tls from "node:tls";
import { Message } from "../messages/message";
import { MessageFactory } from "../messages/factory";
import { EventEmitter } from "node:events";
import { getSubjectFromCert } from "../utils";
import { Peer } from "./pubsub";

export declare interface NodeClient {
  on(event: "connected", listener: (id: number) => void): void;
  on(event: "disconnected", listener: () => void): void;
  on(event: "message", listener: (raw: Buffer) => void): void;
}

export class NodeClient implements Peer {
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
  private theirId: number | null = null;
  // Our id. Set when the client is made
  private ourId: number;
  // A queue of messages to send to the node
  private readonly buffer: Buffer[] = [];
  // Make sure we only have one connection attempt at a time
  private connectPromise: Promise<void> | null = null;
  // Make sure we only have one flush at a time
  private flushPromise: Promise<void> | null = null;

  private pingInterval: NodeJS.Timeout | null = null;

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

    const subject = getSubjectFromCert(cert);
    this.ourId = parseInt(subject.CN!, 10);
  }

  getTheirId(): number {
    if (this.theirId === null) {
      throw new Error("Client has not yet been connected");
    }

    return this.theirId;
  }

  hasConnected(): boolean {
    return this.hasBeenConnected !== null;
  }

  getOurId(): number {
    return this.ourId;
  }

  connect(reconnect = false): Promise<void> {
    if (this.connectPromise !== null) {
      // If we are already connecting, return the existing promise
      return this.connectPromise;
    }

    if (reconnect === false && this.connected) {
      return Promise.resolve();
    }

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
        if (this.client) {
          this.client.removeAllListeners();
          this.client.destroy();
        }

        this.client = tls.connect(options);

        this.client.setNoDelay(true);

        attempts++;

        this.client.on("end", () => {
          this.handleDisconnected();
        });

        this.client.on("error", (err) => {
          console.error("Error with node connection");
          console.error(err);

          this.handleDisconnected();

          // Max wait of 1 minute between attempts
          const wait = Math.min(
            1 * 60 * 1000,
            // Exponential backoff with a random factor to prevent the "thundering herd" problem
            1000 * Math.pow(2, attempts - 1) + Math.floor(Math.random() * 1000),
          );

          console.log(
            "Peer connection failed, reconnecting in " + wait + "ms...",
          );

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

          this.theirId = id;
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

    this.connected = true;
    this.hasBeenConnected = true;

    this.eventEmitter.emit("connected");

    this.publish(MessageFactory.clientHello(this.getTheirId()));
  }

  private handleDisconnected(): void {
    if (this.connected === false) {
      return;
    }

    this.connected = false;

    if (this.client) {
      this.client.removeAllListeners();
      this.client.destroy();
    }

    this.client = null;

    this.eventEmitter.emit("disconnected");

    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleData(data: Buffer): void {
    this.eventEmitter.emit("message", data);
  }

  publish(message: Message): Promise<void> {
    return this.publishEncoded(message.encode());
  }

  private publishEncoded(raw: Buffer): Promise<void> {
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

  private flush(): Promise<void> {
    if (this.flushPromise !== null) {
      return this.flushPromise;
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
          console.log("Error in flush");
          console.error(err);
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
