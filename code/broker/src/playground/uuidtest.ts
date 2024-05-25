import { uuidv7, UUID } from "uuidv7";

const uuid = uuidv7();
const timestampBytes = new Uint8Array(8);
timestampBytes.set(
  new Uint8Array(UUID.parse(uuid).bytes.buffer.slice(0, 6)),
  2,
);
const timestampMs = new DataView(timestampBytes.buffer).getBigUint64(0);

console.log(Number(timestampMs), Date.now());
