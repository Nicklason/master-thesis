import { MessageFactory } from "./factory";
import { Message } from "./implementations/message";
import { MessageType } from "./types";

describe("MessageFactory", () => {
  beforeEach(() => {
    // Reset source between tests
    MessageFactory.setSource();
  });

  test("setting source", () => {
    expect(() => MessageFactory.ping()).toThrow(
      new Error("Message source is required"),
    );

    MessageFactory.setSource(1);

    expect(() => MessageFactory.ping()).not.toThrow();
  });

  test("create a message", () => {
    MessageFactory.setSource(1);
    const message = MessageFactory.ping();

    expect(message).toBeInstanceOf(Message);

    expect(message.type).toBe(MessageType.PING);
    expect(message.source).toBe(1);
  });

  test("create a message with payload", () => {
    MessageFactory.setSource(1);

    const message = MessageFactory.create(MessageType.DATA, {
      topic: "foo",
      value: Buffer.from("bar"),
    }).build();

    expect(message.type).toBe(MessageType.DATA);
    expect(message.source).toBe(1);
    expect(message.payload).toEqual({
      topic: "foo",
      value: Buffer.from("bar"),
    });
  });
});
