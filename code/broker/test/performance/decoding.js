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
  .add("JSON (total)", () => {
    JSON.parse(jsonEncode);
  })
  .add("Protobuf (total)", () => {
    MessageProto.decode(protoEncode);
  })
  .add("Custom (total)", () => {
    TotalTranscoder.decodeMessage(customEncode);
  })
  .add("Custom (version)", () => {
    new SelectiveMessage(customEncode).version;
  })
  .add("Custom (id)", () => {
    new SelectiveMessage(customEncode).id;
  })
  .add("Custom (timestamp)", () => {
    // Timestamp is the last value
    new SelectiveMessage(customEncode).timestamp;
  })
  .add("Reader (total)", () => {
    const reader = Reader.create(customEncode);

    // Version
    reader.uint32();
    // Id
    reader.string();
    // Destinations
    reader.uint32();
    // Source
    reader.uint32();
    // Type
    reader.uint32();
    // Payload
    reader.bytes();
    // Timestamp
    reader.uint32();
  })
  .add("Reader (version)", () => {
    const reader = Reader.create(customEncode);

    // Version
    reader.uint32();
  })
  .add("Reader (id)", () => {
    const reader = Reader.create(customEncode);

    // Version
    reader.uint32();
    // Id
    reader.string();
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
