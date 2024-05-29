import { Reader, Writer } from "protobufjs";
import { IncrementalTranscoder, IncrementalTranscoderBuilder } from "./incremental-transcoder";

describe("IncrementalTranscoder", () => {
  test("add field", () => {
    const builder = new IncrementalTranscoderBuilder<{
      foo: number;
    }>();

    const read = jest.fn().mockReturnValue(1);
    const write = jest.fn();

    builder.addField("foo", read, write);

    // The data that we will be deserializing
    const data = Buffer.alloc(0);

    const deserializer = builder.build(data);

    expect(deserializer.getBuffer()).toEqual(data);

    const fieldValue = deserializer.getValue("foo");

    expect(read).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(0);

    expect(fieldValue.value).toBe(1);
    expect(fieldValue.position).toBe(0);
    expect(fieldValue.length).toBe(0);
  });

  test("get field value", () => {
    const builder = new IncrementalTranscoderBuilder<{
      foo: number;
    }>();

    builder.addField("foo", (reader) => reader.int32(), jest.fn());

    const data = Buffer.from(Writer.create().uint32(1).finish());

    const deserializer = builder.build(data);

    const fieldValue = deserializer.getValue("foo");

    expect(fieldValue.value).toBe(1);
    expect(fieldValue.position).toBe(0);
    expect(fieldValue.length).toBe(1);
  });

  test("set field value", () => {
    const builder = new IncrementalTranscoderBuilder<{
      foo: number;
    }>();

    builder.addField(
      "foo",
      (reader) => reader.int32(),
      (writer, value) => writer.int32(value),
    );

    const data = Buffer.from(Writer.create().uint32(1).finish());

    const deserializer = builder.build(data);

    const firstFieldValue = deserializer.getValue("foo");

    expect(firstFieldValue.value).toBe(1);
    expect(firstFieldValue.position).toBe(0);
    expect(firstFieldValue.length).toBe(1);

    deserializer.setValue("foo", 2);

    const secondFieldValue = deserializer.getValue("foo");

    expect(secondFieldValue.value).toBe(2);
    expect(secondFieldValue.position).toBe(0);
    expect(secondFieldValue.length).toBe(1);
  });

  test("set field value and update position of next fields", () => {
    const builder = new IncrementalTranscoderBuilder<{
      foo: number;
      bar: number;
    }>();

    builder.addField(
      "foo",
      (reader) => reader.int32(),
      (writer, value) => writer.int32(value),
    );

    builder.addField(
      "bar",
      (reader) => reader.int32(),
      (writer, value) => writer.int32(value),
    );

    const data = Buffer.from(Writer.create().uint32(1).uint32(2).finish());

    const deserializer = builder.build(data);

    const foo = deserializer.getValue("foo");

    expect(foo.value).toBe(1);
    expect(foo.position).toBe(0);
    expect(foo.length).toBe(1);

    const bar = deserializer.getValue("bar");

    expect(bar.value).toBe(2);
    expect(bar.position).toBe(1);
    expect(bar.length).toBe(1);

    deserializer.setValue("foo", 1000);

    const newFoo = deserializer.getValue("foo");

    expect(newFoo.value).toBe(1000);
    expect(newFoo.position).toBe(0);
    expect(newFoo.length).toBe(2);

    const newBar = deserializer.getValue("bar");

    expect(newBar.value).toBe(2);
    expect(newBar.position).toBe(2);
    expect(newBar.length).toBe(1);
  });

  test("set field value without updating next fields", () => {
    const builder = new IncrementalTranscoderBuilder<{
      foo: number;
      bar: number;
    }>();

    builder.addField(
      "foo",
      (reader) => reader.int32(),
      (writer, value) => writer.int32(value),
    );

    builder.addField(
      "bar",
      (reader) => reader.int32(),
      (writer, value) => writer.int32(value),
    );

    const data = Buffer.from(Writer.create().uint32(1).uint32(2).finish());

    const deserializer = builder.build(data);

    // Get value of first field
    const foo = deserializer.getValue("foo");

    expect(foo.value).toBe(1);
    expect(foo.position).toBe(0);
    expect(foo.length).toBe(1);

    // Set value of firdocker build -t broker . && docker compose up -d && docker compose logs -fst field
    deserializer.setValue("foo", 1000);

    const newFoo = deserializer.getValue("foo");

    expect(newFoo.value).toBe(1000);
    expect(newFoo.position).toBe(0);
    expect(newFoo.length).toBe(2);

    // Get value of second field
    const bar = deserializer.getValue("bar");

    expect(bar.value).toBe(2);
    expect(bar.position).toBe(2);
    expect(bar.length).toBe(1);
  });

  test("get last field value", () => {
    const builder = new IncrementalTranscoderBuilder<{
      foo: number;
      bar: number;
    }>();

    const fooRead = jest
      .fn()
      .mockImplementation((reader: Reader) => reader.int32());

    const barRead = jest
      .fn()
      .mockImplementation((reader: Reader) => reader.int32());

    const write = jest.fn();

    builder.addField("foo", fooRead, write);
    builder.addField("bar", barRead, write);

    const data = Buffer.from(Writer.create().uint32(1).uint32(2).finish());

    const deserializer = builder.build(data);

    const bar = deserializer.getValue("bar");

    expect(bar.value).toBe(2);
    expect(bar.position).toBe(1);
    expect(bar.length).toBe(1);

    expect(fooRead).toHaveBeenCalledTimes(1);
    expect(barRead).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(0);
  });
});
