import {
  MessagePayload,
  MessageType,
  Message,
  PayloadNotRequiredMessageType,
  PayloadRequiredMessageType,
} from "./message";
import { v4 as uuidv4 } from "uuid";
import Long from "long";

export class MessageBuilder<T extends MessageType> {
  private id: string;
  private type: T;
  private payload: MessagePayload[T];
  private source: number;
  private destinations: number[] = [];
  private timestamp: Long;

  constructor(
    type: PayloadNotRequiredMessageType,
    payload?: MessagePayload[PayloadNotRequiredMessageType],
  );
  constructor(
    type: PayloadRequiredMessageType,
    payload: MessagePayload[PayloadRequiredMessageType],
  );
  constructor(type: T, payload: MessagePayload[T]) {
    this.type = type;
    this.payload = payload;
  }

  setId(id: string): this {
    this.id = id;
    return this;
  }

  setType(type: T): this {
    this.type = type;
    return this;
  }

  setPayload(payload: MessagePayload[T]): this {
    this.payload = payload;
    return this;
  }

  setSource(source: number): this {
    this.source = source;
    return this;
  }

  setDestinations(destinations: number[]): this {
    this.destinations = destinations;
    return this;
  }

  setTimestamp(timestamp: Long): this {
    this.timestamp = timestamp;
    return this;
  }

  build(): Message<T> {
    if (this.id === undefined) {
      this.id = uuidv4();
    }

    if (this.type === undefined) {
      throw new Error("Message type is required");
    } else if (this.source === undefined) {
      throw new Error("Message source is required");
    }

    return new Message(
      this.id,
      this.type,
      this.payload,
      this.source,
      this.destinations,
      this.timestamp,
    );
  }
}
