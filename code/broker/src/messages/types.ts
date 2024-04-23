import Long from "long";

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
  // Contains information about the entire network
  TOPOLOGY = 11,
}

/**
 * A message that has been decoded from a buffer
 */
export interface DecodedMessage<
  T extends MessageType = MessageType,
  D extends Buffer | null = Buffer | null,
> {
  id: string;
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

/**
 * The decoded messages for all message types
 */
export type DecodedMessages = {
  [K in keyof MessagePayload]: MessagePayload[K] extends null
    ? DecodedMessage<K, null>
    : DecodedMessage<K, Buffer>;
}[keyof MessagePayload];

export interface PongMessagePayload {
  message_id: string;
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

export type Node = number;

export enum LinkState {
  UP = 1,
  DOWN = 2,
}

export interface LinkChange {
  state: LinkState;
  source: Node;
  target: Node;
  timestamp: Long;
}

export interface TopologyMessagePayload {
  nodes: number[];
  edges: LinkChange[];
}

/**
 * The different payloads for different message types
 *
 * The keys are the message types and the values are the payload types
 * If the payload is null, then the message has no payload.
 * For example, a message with type PING has a payload of type null and
 * a message with type DATA has a payload of type DataMessagePayload.
 */
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
  [MessageType.TOPOLOGY]: TopologyMessagePayload;
};

/**
 * The message types that require a payload
 */
export type PayloadRequiredMessageType = {
  [K in keyof MessagePayload]: MessagePayload[K] extends null ? never : K;
}[keyof MessagePayload];

/**
 * The message types that do not have a payload
 */
export type PayloadNotRequiredMessageType = Exclude<
  keyof MessagePayload,
  PayloadRequiredMessageType
>;
