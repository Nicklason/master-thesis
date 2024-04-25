import Long from "long";
import { MessagePayload, MessageType } from "../types";

export abstract class Message<T extends MessageType = MessageType> {
  public abstract get id(): string;
  public abstract get type(): T;
  public abstract get payload(): MessagePayload[T];
  public abstract get source(): number;
  public abstract get destinations(): number[];
  public abstract get timestamp(): Long;

  abstract removeDestination(destination: number): void;

  isDestination(node: number): boolean {
    return this.isBroadcast() || this.destinations.includes(node);
  }

  isFinalDestination(node: number): boolean {
    return this.destinations.includes(node);
  }

  isBroadcast(): boolean {
    return this.destinations.length === 0;
  }

  abstract encode(): Buffer;
}

/**
 * A union of all message types
 */
export type Messages = {
  [K in keyof MessagePayload]: Message<K>;
}[keyof MessagePayload];
