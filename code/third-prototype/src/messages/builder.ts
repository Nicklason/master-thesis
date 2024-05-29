import {
  MessagePayload,
  MessageType,
  PayloadNotRequiredMessageType,
  PayloadRequiredMessageType,
} from "./types";
import { Message } from "./implementations/message";
import { v4 as uuidv4 } from "uuid";
import Long from "long";
import { LocalMessage } from "./implementations/local-message";

export class MessageBuilder<T extends MessageType> {
  private id: string;
  private type: T;
  private payload: MessagePayload[T];
  private source: number;
  private destinations: number[] = [];
  private timestamp: Long;
  private now = Date.now();

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
    if (this.type === undefined) {
      throw new Error("Message type is required");
    } else if (this.source === undefined) {
      throw new Error("Message source is required");
    }

    return new LocalMessage(
      this.id ?? uuidv4(),
      this.type,
      (this.payload ?? null) as MessagePayload[T],
      this.source,
      this.destinations,
      this.timestamp ?? Long.fromNumber(this.now, true),
    );
  }
}
