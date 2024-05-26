const benchmark = require("benchmark");

const { root } = require("../../dist/messages/proto");
const { TotalTranscoder } = require("../../dist/messages/encoding/total-transcoder");
const { messageIncrementalTranscoder } = require("../../dist/messages/encoding/incremental-transcoder");
const Long = require("long");
const { Writer } = require("protobufjs");

const suite = new benchmark.Suite();

const data = {
  id: "e9a10ed0-e2fe-4e87-af1f-87b88b51f73d",
  source: 1,
  destinations: [],
  type: 1,
  payload: null,
  timestamp: Long.fromNumber(0, true),
};

const MessageProto = root.lookupType("Message");

const buffer = TotalTranscoder.encodeMessage(data);

let incremental = messageIncrementalTranscoder(buffer);

suite
  .add("JSON (total)", () => {
    JSON.stringify(data);
  })
  .add("Protobuf (total)", () => {
    Buffer.from(MessageProto.encode(data).finish());
  })
  .add("Custom (total)", () => {
    TotalTranscoder.encodeMessage(data);
  })
  .add("Custom (version)", () => {
    incremental.setValue("version", 1);
  })
  .add("Custom (destinations)", () => {
    incremental.setValue("destinations", []);
  })
  .add("Writer (total)", () => {
    const writer = Writer.create();
    // Version
    writer.uint32(0);
    // Id
    writer.string(data.id);
    // Destinations
    writer.uint32(data.destinations.length);
    // Source
    writer.uint32(data.source);
    // Type
    writer.uint32(data.type);
    // Payload
    writer.bytes(Buffer.alloc(0));
    // Timestamp
    writer.uint32(0);
    writer.finish();
  })
  .add("Writer (one value)", () => {
    const writer = Writer.create();
    writer.uint32(0);
    writer.finish();
  })
  .on("cycle", (event) => {
    console.log(String(event.target));
  })
  .on("complete", function () {
    console.log("Fastest is " + this.filter("fastest").map("name"));
  })
  .run({
    async: true,
    delay: 10000,
    minTime: 10000,
  });
