import { Reader, Writer } from "protobufjs";
import Long from "long";
import { DecodedMessages, MessagePayload, MessageType } from "./types";
import { getPayloadProtobufType } from "./proto";

/**
 * Serializer class to encode and decode messages and payloads
 *
 * The format is as follows:
 * - version: uint32
 * - id: string
 * - destinationCount: uint32
 * - destinations: uint32[]
 * - source: uint32
 * - type: uint32
 * - payload: bytes (protobuf encoded based on the message type)
 * - timestamp: uint64
 *
 * The version is the first field because you need to use it to determine how
 * to decode the rest of the message.
 * The id is the second because it allows us to quickly know if we have already
 * seen the message before.
 * The destinations are next because it is determined to know if the message is
 * for us and how it should be routed.
 * The type and payload are next because it is the actual content of the
 * message and not important for routing.
 * The timestamp is last because it is not important for routing, but it is for
 * ordering, which should only be relevant when you get the payload.
 */
export class Serializer {
  static encodeMessage(message: DecodedMessages): Buffer {
    const writer = Writer.create();

    // Version
    writer.uint32(0);
    writer.string(message.id);
    writer.uint32(message.destinations.length);
    for (const destination of message.destinations) {
      writer.uint32(destination);
    }
    writer.uint32(message.source);
    writer.uint32(message.type);
    writer.bytes(message.payload ?? Buffer.alloc(0));
    writer.uint64(message.timestamp);

    return Buffer.from(writer.finish());
  }

  static decodeMessage(data: Buffer): DecodedMessages {
    const reader = Reader.create(data);

    const version = reader.uint32();
    // TODO: Support multiple versions
    if (version !== 0) {
      throw new Error(`Invalid message version: ${version}`);
    }

    const id = reader.string();
    const destinationCount = reader.uint32();
    const destinations: number[] = [];
    for (let i = 0; i < destinationCount; i++) {
      destinations.push(reader.uint32());
    }
    const source = reader.uint32();
    const type = reader.uint32();
    const rawPayload = reader.bytes();
    const timestamp = reader.uint64();

    const payload =
      rawPayload.byteLength === 0 ? null : Buffer.from(rawPayload);

    return {
      id: id,
      type: type,
      payload: payload,
      source: source,
      destinations: destinations,
      timestamp: new Long(timestamp.low, timestamp.high, timestamp.unsigned),
    };
  }

  static encodePayload<T extends MessageType>(
    type: T,
    payload: MessagePayload[T],
  ): Buffer {
    if (payload === null) {
      return Buffer.alloc(0);
    }

    const proto = getPayloadProtobufType(type);

    return Buffer.from(proto.encode(payload).finish());
  }

  static decodePayload<T extends MessageType>(
    type: T,
    payload: Buffer,
  ): MessagePayload[T] {
    const proto = getPayloadProtobufType(type);

    return proto.decode(payload) as unknown as MessagePayload[T];
  }
}
