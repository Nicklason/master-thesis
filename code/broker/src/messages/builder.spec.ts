import Long from "long";
import { MessageBuilder } from "./builder";
import { MessageType } from "./types";
import { Message } from "./implementations/message";

describe("MessageBuilder", () => {
  test("create a message", () => {
    const payload = {
      topic: "foo",
      value: Buffer.from("bar"),
    };

    const builder = new MessageBuilder(MessageType.DATA, payload).setSource(1);

    const message = builder.build();

    // Make sure the result is a Message
    expect(message).toBeInstanceOf(Message);

    // Make sure the message is as expected
    expect(message.id).toBeDefined();
    expect(message.source).toBe(1);
    expect(message.destinations).toEqual([]);
    expect(message.type).toBe(MessageType.DATA);
    expect(message.payload).toBe(payload);
    expect(message.timestamp).toBeDefined();
  });

  test("missing source", () => {
    const builder = new MessageBuilder(MessageType.PING);

    expect(() => builder.build()).toThrow(
      new Error("Message source is required"),
    );
  });

  test("setting id and timestamp", () => {
    const builder = new MessageBuilder(MessageType.PING).setSource(1);

    const id = "foo";
    const timestamp = Long.fromNumber(0, true);

    builder.setId(id);
    builder.setTimestamp(timestamp);

    const message = builder.build();

    expect(message.id).toEqual(id);
    expect(message.timestamp).toEqual(timestamp);
  });
});
