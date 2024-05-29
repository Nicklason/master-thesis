import protobuf from "protobufjs/light";
import { MessageType } from "./types";

export const root = protobuf.Root.fromJSON({
  nested: {
    Message: {
      fields: {
        id: {
          type: "string",
          id: 1,
        },
        type: {
          type: "uint32",
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
    LinkState: {
      values: {
        UP: 0,
        DOWN: 1,
      },
    },
    LinkChange: {
      fields: {
        state: {
          id: 1,
          type: "LinkState",
        },
        source: {
          type: "uint32",
          id: 2,
        },
        target: {
          type: "uint32",
          id: 3,
        },
        timestamp: {
          type: "uint64",
          id: 4,
        },
      },
    },
    TopologyMessagePayload: {
      fields: {
        nodes: {
          type: "uint32",
          id: 1,
          rule: "repeated",
        },
        edges: {
          type: "LinkChange",
          id: 2,
          rule: "repeated",
        },
      },
    },
  },
});

/**
 * Get the protobuf type for a message type
 */
export function getPayloadProtobufType(type: MessageType): protobuf.Type {
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
