import { MessagePayload, MessageType } from "../types";
import Long from "long";
import { Serializer } from "../serializer";
import { messageSerializer } from "../deserializer";
import { Message } from "./message";

export class SelectiveMessage<
  T extends MessageType = MessageType,
> extends Message {
  private readonly deserializer: ReturnType<typeof messageSerializer>;

  constructor(data: Buffer) {
    super();

    this.deserializer = messageSerializer(data);
  }

  get id(): string {
    return this.deserializer.getValue("id").value;
  }

  get type(): T {
    return this.deserializer.getValue("type").value as T;
  }

  get payload(): MessagePayload[T] {
    const payload = this.deserializer.getValue("payload").value;
    if (payload.byteLength === 0) {
      return null as any;
    }

    return Serializer.decodePayload(this.type, payload);
  }

  get source(): number {
    return this.deserializer.getValue("source").value;
  }

  get destinations(): number[] {
    return this.deserializer.getValue("destinations").value;
  }

  setDestinations(destinations: number[]) {
    this.deserializer.setValue("destinations", destinations);
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
