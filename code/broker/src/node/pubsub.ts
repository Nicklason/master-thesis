import { Message } from "../messages/message";

export interface Peer extends MessagePublisher, MessageSubscriber {
  getTheirId: () => number;
}

export interface MessagePublisher {
  publish: (message: Message) => Promise<void>;
}

export interface MessageSubscriber {
  on(event: "message", listener: (source: number, raw: Buffer) => void): void;
  off(event: "message", listener: (...args: any[]) => void): void;
}
