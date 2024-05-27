import fs from "node:fs";
import { MessageFactory } from "../messages/factory";
import { Reader, Writer } from "protobufjs";

// Write stream append to file

const writeStream = fs.createWriteStream("output.txt", { flags: "a" });

MessageFactory.setSource(1);

const message = MessageFactory.ping();

const encoded = message.encode();

console.log("message length", encoded.length);

const writer = Writer.create();
writer.bytes(encoded);

const buffer = writer.finish();

writeStream.write(buffer);
writeStream.end(() => {
  console.log("Stream ended");

  const readStream = fs.createReadStream("output.txt");

  let chunky = Buffer.alloc(0);
  let position = 0;

  let length: number | undefined = undefined;

  readStream.on("data", (chunk) => {
    if (!Buffer.isBuffer(chunk)) {
      return;
    }

    chunky = Buffer.concat([chunky.subarray(position), chunk]);

    const reader = Reader.create(chunky);
    reader.pos = position;

    while (chunky.length - reader.pos >= 10) {
      if (length === undefined) {
        length = reader.uint32();
        // Reset position
        reader.pos = position;
      }

      if (chunky.length >= length) {
        const message = reader.bytes();
        console.log("message", message);
        position = reader.pos;
        length = undefined;
      }
    }
  });
});
