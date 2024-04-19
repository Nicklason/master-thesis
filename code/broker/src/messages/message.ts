import protobuf from "protobufjs/light";
import Long from "long";

const root = protobuf.Root.fromJSON({
  nested: {
    MessageType: {
      values: {
        SERVER_HELLO: 1,
        CLIENT_HELLO: 2,
        PING: 3,
        PONG: 4,
        NODE_CONNECT: 5,
        NODE_DISCONNECT: 6,
        PUBLISH_TOPIC: 7,
        SUBSCRIBE_TOPIC: 8,
        DATA: 9,
        NETWORK: 10,
      },
    },
    Message: {
      fields: {
        id: {
          type: "string",
          id: 1,
        },
        type: {
          type: "MessageType",
          id: 2,
        },
        payload: {
          type: "bytes",
          id: 3,
        },
        source: {
          type: "uint32",
          id: 4,
        },
        destinations: {
          type: "uint32",
          id: 5,
          rule: "repeated",
        },
        timestamp: {
          type: "uint64",
          id: 6,
        },
      },
    },
    ServerHelloMessagePayload: {
      fields: {},
    },
    ClientHelloMessagePayload: {
      fields: {},
    },
    PingMessagePayload: {
      fields: {},
    },
    PongMessagePayload: {
      fields: {
        message_id: {
          type: "string",
          id: 1,
        },
        message_source: {
          type: "uint32",
          id: 2,
        },
      },
    },
    NodeConnectMessagePayload: {
      fields: {
        node_id: {
          type: "uint32",
          id: 1,
        },
        node_address: {
          type: "string",
          id: 2,
        },
        node_port: {
          type: "uint32",
          id: 3,
        },
      },
    },
    NodeDisconnectMessagePayload: {
      fields: {
        node_id: {
          type: "uint32",
          id: 1,
        },
      },
    },
    PublishTopicMessagePayload: {
      fields: {},
    },
    SubscribeTopicMessagePayload: {
      fields: {},
    },
    DataMessagePayload: {
      fields: {
        topic: {
          type: "string",
          id: 1,
        },
        value: {
          type: "bytes",
          id: 2,
        },
      },
    },
    NetworkMessagePayload: {
      fields: {},
    },
  },
});

export enum MessageType {
  // First message sent by the server to the client
  SERVER_HELLO = 1,
  // First message sent by the client to the server
  CLIENT_HELLO = 2,
  // Pings are used to check if other party is responsive and to measure latency
  PING = 3,
  // Response to a ping message
  PONG = 4,
  // Published when a peer connects to the network
  NODE_CONNECT = 5,
  // Published when a peer disconnects from the network
  NODE_DISCONNECT = 6,
  // Published when a peer exposes a topic to the network
  PUBLISH_TOPIC = 7,
  // Published when a peer subscribes to a topic
  SUBSCRIBE_TOPIC = 8,
  // Data from a topic
  DATA = 9,
  // Contains information about parts of the network (nodes, edges, etc. and their metadata)
  NETWORK = 10,
}

export interface DecodedMessage<
  T extends MessageType = MessageType,
  D extends Buffer | null = Buffer | null,
> {
  id: String;
  // The type of message
  type: T;
  // The contents of the message
  payload: D;
  // The node that the message originated from
  source: number;
  // The nodes that the message is intended for
  // No destinations is broadcast, one is unicast, more than one is multicast
  // TODO: Anycast support
  destinations: number[];
  timestamp: Long;
}

export class Message<T extends MessageType = MessageType> {
  readonly id: String;
  readonly type: T;
  private readonly _payload: Buffer | MessagePayload[T];
  readonly source: number;
  readonly destinations: number[];
  readonly timestamp: Long;

  constructor(
    id: String,
    type: T,
    payload: Buffer | MessagePayload[T],
    source: number,
    destinations: number[] = [],
    timestamp?: Long,
  ) {
    this.id = id;
    this.type = type;
    this._payload = payload;
    this.source = source;
    this.destinations = destinations;
    this.timestamp = timestamp ?? Long.fromNumber(Date.now());
  }

  private getPayload(): Buffer | MessagePayload[T] {
    return this._payload;
  }

  get payload(): MessagePayload[T] {
    const payload = this.getPayload();

    // Check if payload is a buffer
    if (Buffer.isBuffer(payload)) {
      return decodePayload(this.type, payload);
    }

    return payload;
  }

  isDestination(node: number): boolean {
    return this.isBroadcast() || this.destinations.includes(node);
  }

  isBroadcast(): boolean {
    return this.destinations.length === 0;
  }

  encode(): Buffer {
    return encodeMessage(this.toJSON());
  }

  toJSON(): DecodedMessages {
    const payload = this.getPayload();

    const encodedPayload = !payload
      ? null
      : Buffer.isBuffer(payload)
        ? payload
        : encodePayload(this.type, payload);

    const message = {
      id: this.id,
      type: this.type,
      payload: encodedPayload,
      source: this.source,
      destinations: this.destinations,
    } as unknown as DecodedMessages;

    return message as DecodedMessages;
  }

  static decode(buffer: Buffer): Messages {
    const message = decodeMessage(buffer, true);

    return new Message(
      message.id,
      message.type,
      message.payload,
      message.source,
      message.destinations,
    ) as unknown as Messages;
  }
}

/**
 * A union of all message types
 */
export type Messages = {
  [K in keyof MessagePayload]: Message<K>;
}[keyof MessagePayload];

export type DecodedMessages = {
  [K in keyof MessagePayload]: MessagePayload[K] extends null
    ? DecodedMessage<K, null>
    : DecodedMessage<K, Buffer>;
}[keyof MessagePayload];

export interface DecodedMessageAndPayload<T extends MessageType> {
  id: String;
  type: MessageType;
  payload: MessagePayload[T];
  source: number;
  destinations: number[];
}

export interface PongMessagePayload {
  message_id: String;
  message_source: number;
}

export interface DataMessagePayload {
  topic: string;
  value: Buffer;
}

export interface NodeConnectMessagePayload {
  node_id: number;
  node_host: string;
  node_port: number;
}

export interface NodeDisconnectMessagePayload {
  node_id: number;
}

export type MessagePayload = {
  [MessageType.SERVER_HELLO]: null;
  [MessageType.CLIENT_HELLO]: null;
  [MessageType.PING]: null;
  [MessageType.PONG]: PongMessagePayload;
  [MessageType.NODE_CONNECT]: NodeConnectMessagePayload;
  [MessageType.NODE_DISCONNECT]: NodeDisconnectMessagePayload;
  [MessageType.PUBLISH_TOPIC]: null;
  [MessageType.SUBSCRIBE_TOPIC]: null;
  [MessageType.DATA]: DataMessagePayload;
  [MessageType.NETWORK]: null;
};

const MessageProto = root.lookupType("Message");

export type PayloadRequiredMessageType = {
  [K in keyof MessagePayload]: MessagePayload[K] extends null ? never : K;
}[keyof MessagePayload];

export type PayloadNotRequiredMessageType = Exclude<
  keyof MessagePayload,
  PayloadRequiredMessageType
>;

/**
 * Get the protobuf type for a message type
 */
function getPayloadProtobufType(type: MessageType): protobuf.Type {
  const key = Object.keys(MessageType).find(
    (key) => MessageType[key] === type,
  ) as keyof typeof MessageType;

  if (!key) {
    throw new Error("Invalid message type");
  }

  const messageName =
    key
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("") + "MessagePayload";

  return root.lookupType(messageName);
}

function encodePayload<T extends MessageType>(
  type: T,
  payload: MessagePayload[T],
): Buffer | null {
  const proto = getPayloadProtobufType(type);

  if (payload === null) {
    return null;
  }

  return Buffer.from(proto.encode(payload).finish());
}

function encodeMessage(message: DecodedMessage): Buffer {
  return Buffer.from(MessageProto.encode(message).finish());
}

function decodeMessage(buffer: Buffer, complete?: false): DecodedMessage;
function decodeMessage(
  buffer: Buffer,
  complete?: true,
): DecodedMessageAndPayload<MessageType>;
/**
 * Decodes a message from a buffer
 * @param buffer The buffer to decode
 * @param complete If true, the payload will be decoded as well. Defaults to false
 */
function decodeMessage(buffer: Buffer, complete: boolean = false): unknown {
  const message = MessageProto.decode(buffer) as unknown as DecodedMessage;

  let payload: unknown;

  if (!(message.payload instanceof Buffer)) {
    payload = null;
  } else if (!complete) {
    payload = message.payload;
  } else {
    payload = decodePayload(message.type, message.payload);
  }

  return {
    id: message.id,
    type: message.type,
    payload: payload,
    source: message.source,
    destinations: message.destinations,
  };
}

/**
 * Decodes a message payload from a buffer
 * @param type The type of the message the payload is for
 * @param buffer The buffer to decode
 * @returns
 */
function decodePayload<T extends MessageType>(
  type: T,
  buffer: Buffer,
): MessagePayload[T] {
  const proto = getPayloadProtobufType(type);

  return proto.decode(buffer) as unknown as MessagePayload[T];
}
