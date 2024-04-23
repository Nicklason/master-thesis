import Long from "long";
import { Reader } from "protobufjs";

interface FieldValue<T> {
  value: T;
  position: number;
  length: number;
}

interface Field<T = unknown, D = unknown> {
  name: T;
  previous: Field | null;
  handler: (reader: Reader) => D;
}

export class DeserializerBuilder<T extends Record<string, unknown>> {
  private fields: Map<keyof T, Field<keyof T, T[keyof T]>> = new Map();
  private lastField: Field<keyof T, T[keyof T]> | null = null;

  addField<K extends keyof T>(
    name: K,
    handler: (reader: Reader) => T[K],
  ): void {
    const field: Field<keyof T, T[keyof T]> = {
      name,
      previous: this.lastField,
      handler,
    };

    this.fields.set(name, field);
    this.lastField = field;
  }

  build(reader: Reader): Deserializer<T> {
    return new Deserializer<T>(reader, this.fields);
  }
}

export class Deserializer<T extends Record<string, any>> {
  private readonly values: Map<keyof T, FieldValue<any>> = new Map();

  constructor(
    private readonly reader: Reader,
    private readonly fields: Map<keyof T, Field<keyof T, T[keyof T]>>,
  ) {}

  getValue<K extends keyof T>(name: K): FieldValue<T[K]> {
    const field = this.fields.get(name);
    return this.getFieldValue(field as Field<K, T[K]>);
  }

  private getFieldValue<K extends keyof T, V>(
    field: Field<K, V>,
  ): FieldValue<V> {
    if (!this.values.has(field.name)) {
      // Get value of previous field
      if (field.previous !== null) {
        this.getFieldValue(field.previous as Field<keyof T, T[keyof T]>);
      }

      const start = this.reader.pos;
      const value = field.handler(this.reader) as V;
      const end = this.reader.pos;
      const length = end - start;

      this.values.set(field.name, {
        value,
        position: start,
        length,
      });
    }

    return this.values.get(field.name)!;
  }
}

// Create a deserialize builder for messages
const builder = new DeserializerBuilder<{
  version: number;
  id: string;
  destinations: number[];
  source: number;
  type: number;
  payload: Buffer;
  timestamp: Long;
}>();

builder.addField("version", (reader) => {
  return reader.uint32();
});

builder.addField("id", (reader) => {
  return reader.string();
});

builder.addField("destinations", (reader) => {
  const count = reader.uint32();

  const destinations: number[] = [];
  for (let i = 0; i < count; i++) {
    destinations.push(reader.uint32());
  }

  return destinations;
});

builder.addField("source", (reader) => {
  return reader.uint32();
});

builder.addField("type", (reader) => {
  return reader.uint32();
});

builder.addField("payload", (reader) => {
  return Buffer.from(reader.bytes());
});

builder.addField("timestamp", (reader) => {
  const timestamp = reader.uint64();
  return new Long(timestamp.low, timestamp.high, timestamp.unsigned);
});

export function messageDeserializer(buffer: Buffer) {
  return builder.build(Reader.create(buffer));
}
