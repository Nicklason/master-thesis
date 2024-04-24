import { TotalTranscoder } from "../encoding/total-transcoder";
import {
  DecodedMessage,
  DecodedMessages,
  MessagePayload,
  MessageType,
} from "../types";
import Long from "long";
import { Message } from "./message";

export class LocalMessage<T extends MessageType> extends Message {
  readonly id: string;
  readonly type: T;
  private readonly _payload: MessagePayload[T];
  private encoded: Buffer | undefined;
  readonly source: number;
  readonly destinations: number[];
  readonly timestamp: Long;

  constructor(
    id: string,
    type: T,
    payload: MessagePayload[T],
    source: number,
    destinations: number[] = [],
    timestamp: Long,
  ) {
    super();

    this.id = id;
    this.type = type;
    this._payload = payload;
    this.source = source;
    this.destinations = destinations;
    this.timestamp = timestamp;
  }

  get payload(): MessagePayload[T] {
    return this._payload;
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

      this.encoded = TotalTranscoder.encodeMessage(message);
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
    return TotalTranscoder.encodePayload(this.type, this._payload);
  }
}
