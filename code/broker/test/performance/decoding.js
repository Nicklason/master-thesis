const benchmark = require("benchmark");

const { root } = require("../../dist/messages/proto");
const { TotalTranscoder } = require("../../dist/messages/encoding/total-transcoder");
const {
  SelectiveMessage,
} = require("../../dist/messages/implementations/selective-message");
const Long = require("long");
const { Reader } = require("protobufjs");

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

const customEncode = TotalTranscoder.encodeMessage(data);
const jsonEncode = JSON.stringify(data);
const protoEncode = Buffer.from(MessageProto.encode(data).finish());

suite
  .add("JSON", () => {
    JSON.parse(jsonEncode);
  })
  .add("Protobuf", () => {
    MessageProto.decode(protoEncode);
  })
  .add("Custom", () => {
    TotalTranscoder.decodeMessage(customEncode);
  })
  .add("Custom (selective)", () => {
    // Timestamp is the last value
    new SelectiveMessage(customEncode).timestamp;
  })
  .add("Custom (selective, only id)", () => {
    // Timestamp is the last value
    new SelectiveMessage(customEncode).id;
  })
  .add("Custom (reader, only id)", () => {
    const reader = Reader.create(customEncode);

    const version = reader.uint32();
    const id = reader.string();
  })
  .on("cycle", (event) => {
    console.log(String(event.target));
  })
  .on("complete", function () {
    console.log("Fastest is " + this.filter("fastest").map("name"));
  })
  .run({
    async: true,
  });
