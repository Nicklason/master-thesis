import { MessagePayload, MessageType } from "../types";
import Long from "long";
import { TotalTranscoder } from "../encoding/total-transcoder";
import { messageIncrementalTranscoder } from "../encoding/incremental-transcoder";
import { Message } from "./message";

export class SelectiveMessage<
  T extends MessageType = MessageType,
> extends Message {
  private readonly deserializer: ReturnType<
    typeof messageIncrementalTranscoder
  >;

  constructor(data: Buffer) {
    super();

    this.deserializer = messageIncrementalTranscoder(data);
  }

  get id(): string {
    return this.deserializer.getValue("id").value;
  }

  get type(): T {
    return this.deserializer.getValue("type").value as T;
  }

  get payload(): MessagePayload[T] {
    const payload = this.deserializer.getValue("payload").value;
    if (payload === null) {
      return null as any;
    }

    return TotalTranscoder.decodePayload(this.type, payload);
  }

  get source(): number {
    return this.deserializer.getValue("source").value;
  }

  get destinations(): number[] {
    return this.deserializer.getValue("destinations").value;
  }

  removeDestination(destination: number): void {
    const index = this.destinations.indexOf(destination);
    if (index === -1) {
      return;
    }

    this.destinations.splice(index, 1);
    this.deserializer.setValue("destinations", this.destinations);
  }

  get timestamp(): Long {
    return this.deserializer.getValue("timestamp").value;
  }

  isDestination(node: number): boolean {
    return this.isBroadcast() || this.destinations.includes(node);
  }

  isBroadcast(): boolean {
    return this.destinations.length === 0;
  }

  encode(): Buffer {
    return this.deserializer.getBuffer();
  }
}
