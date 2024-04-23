import Long from "long";
import {
  DecodedMessage,
  DecodedMessages,
  MessagePayload,
  MessageType,
} from "./types";
import { Serializer } from "./serializer";

export class Message<T extends MessageType = MessageType> {
  readonly id: string;
  readonly type: T;
  private readonly _payload: Buffer | MessagePayload[T];
  private decodedPayload: MessagePayload[T] | undefined;
  private encoded: Buffer | undefined;
  readonly source: number;
  readonly destinations: number[];
  readonly timestamp: Long;

  constructor(
    id: string,
    type: T,
    payload: Buffer | MessagePayload[T],
    source: number,
    destinations: number[] = [],
    timestamp: Long,
  ) {
    this.id = id;
    this.type = type;
    this._payload = payload;
    this.source = source;
    this.destinations = destinations;
    this.timestamp = timestamp;
  }

  get payload(): MessagePayload[T] {
    // Check if payload is not a buffer
    if (!Buffer.isBuffer(this._payload)) {
      return this._payload;
    }

    // Check if payload is not already decoded
    if (this.decodedPayload === undefined) {
      this.decodedPayload = Serializer.decodePayload(this.type, this._payload);
    }

    // Return the decoded payload
    return this.decodedPayload;
  }

  isDestination(node: number): boolean {
    return this.isBroadcast() || this.destinations.includes(node);
  }

  isFinalDestination(node: number): boolean {
    return this.destinations.includes(node);
  }

  isBroadcast(): boolean {
    return this.destinations.length === 0;
  }

  encode(): Buffer {
    if (this.encoded === undefined) {
      const message = {
        id: this.id,
        type: this.type,
        payload: this.getEncodedPayload(),
        source: this.source,
        destinations: this.destinations,
        timestamp: this.timestamp,
      } satisfies DecodedMessage as DecodedMessages;

      this.encoded = Serializer.encodeMessage(message);
    }

    return this.encoded;
  }

  private getEncodedPayload(): Buffer | null {
    if (!this._payload) {
      return null;
    }

    if (Buffer.isBuffer(this._payload)) {
      return this._payload;
    }

    // No need to cache this because the method is private and only used by the encode method which is cached
    return Serializer.encodePayload(this.type, this._payload);
  }

  static decode(buffer: Buffer): Messages {
    const message = Serializer.decodeMessage(buffer);

    const messageObject = new Message(
      message.id,
      message.type,
      message.payload,
      message.source,
      message.destinations,
      message.timestamp,
    ) as unknown as Messages;

    // Store the encoded message for later use
    messageObject.encoded = buffer;

    return messageObject;
  }
}

/**
 * A union of all message types
 */
export type Messages = {
  [K in keyof MessagePayload]: Message<K>;
}[keyof MessagePayload];
