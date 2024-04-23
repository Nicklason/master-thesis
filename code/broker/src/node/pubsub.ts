import { Message } from "../messages/implementations/message";

export interface Peer {
  getId: () => number | null;
}

export interface MessagePublisher {
  publish: (message: Message) => Promise<void>;
}

export interface MessageSubscriber {
  on(event: "message", listener: (source: number, raw: Buffer) => void): void;
  off(event: "message", listener: (...args: any[]) => void): void;
}
