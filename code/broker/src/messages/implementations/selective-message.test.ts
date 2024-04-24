import { MessageBuilder } from "../builder";
import { MessageType } from "../types";
import { SelectiveMessage } from "./selective-message";

describe("SelectiveMessage", () => {
  test("properly decode message without payload", () => {
    // We assume message builder is working correctly
    const truth = new MessageBuilder(MessageType.PING).setSource(1).build();

    const selective = new SelectiveMessage(truth.encode());

    expect(selective.id).toEqual(truth.id);
    expect(selective.destinations).toEqual(truth.destinations);
    expect(selective.source).toEqual(truth.source);
    expect(selective.type).toEqual(truth.type);
    expect(selective.payload).toEqual(truth.payload);
    expect(selective.timestamp).toEqual(truth.timestamp);
  });

  test("properly decode message with payload", () => {
    const truth = new MessageBuilder(MessageType.DATA, {
      topic: "foo",
      value: Buffer.from("bar"),
    })
      .setSource(1)
      .build();

    const selective = new SelectiveMessage(truth.encode());

    expect(selective.id).toEqual(truth.id);
    expect(selective.destinations).toEqual(truth.destinations);
    expect(selective.source).toEqual(truth.source);
    expect(selective.type).toEqual(truth.type);
    expect(selective.payload).toEqual(truth.payload);
    expect(selective.timestamp).toEqual(truth.timestamp);
  });

  test("set destinations", () => {
    const truth = new MessageBuilder(MessageType.PING).setSource(1).build();

    const selective = new SelectiveMessage(truth.encode());

    selective.setDestinations([1, 2, 3]);

    expect(selective.id).toEqual(truth.id);

    // Make sure value is set
    expect(selective.destinations).toEqual([1, 2, 3]);

    // Make sure next values are read correctly
    expect(selective.source).toEqual(truth.source);
    expect(selective.type).toEqual(truth.type);
    expect(selective.payload).toEqual(truth.payload);
    expect(selective.timestamp).toEqual(truth.timestamp);

    const expectedEncoded = new MessageBuilder(MessageType.PING)
      .setId(truth.id)
      .setTimestamp(truth.timestamp)
      .setSource(truth.source)
      .setDestinations([1, 2, 3])
      .build()
      .encode();

    // Test that the encoded value is correct
    expect(selective.encode()).toEqual(expectedEncoded);
  });
});
