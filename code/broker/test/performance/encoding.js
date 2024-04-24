const benchmark = require("benchmark");

const { root } = require("../../dist/messages/proto");
const { TotalTranscoder } = require("../../dist/messages/encoding/total-transcoder");
const Long = require("long");

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

suite
  .add("JSON", () => {
    JSON.stringify(data);
  })
  .add("Protobuf", () => {
    Buffer.from(MessageProto.encode(data).finish());
  })
  .add("Custom", () => {
    TotalTranscoder.encodeMessage(data);
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
