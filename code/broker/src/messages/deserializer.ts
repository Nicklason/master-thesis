import Long from "long";
import { Reader, Writer } from "protobufjs";

interface FieldValue<T> {
  value: T;
  position: number;
  length: number;
}

interface Field<T = unknown, D = unknown> {
  name: T;
  previous: Field | null;
  next: Field | null;
  read: (reader: Reader) => D;
  write: (writer: Writer, value: D) => void;
}

/**
 * DeserializerBuilder is a builder for creating deserializers for a specific type.
 * The deserializer is used to read and write values from a buffer.
 */
export class DeserializerBuilder<T extends Record<string, unknown>> {
  private fields: Map<keyof T, Field<keyof T, T[keyof T]>> = new Map();
  private lastField: Field<keyof T, T[keyof T]> | null = null;

  addField<K extends keyof T>(
    name: K,
    read: (reader: Reader) => T[K],
    write: (writer: Writer, value: T[K]) => void,
  ): void {
    const field: Field<keyof T, T[keyof T]> = {
      name,
      previous: this.lastField,
      next: null,
      read,
      write,
    };

    if (this.lastField) {
      this.lastField.next = field;
    }

    this.fields.set(name, field);
    this.lastField = field;
  }

  build(buffer: Buffer): Deserializer<T> {
    return new Deserializer<T>(buffer, this.fields);
  }
}

/**
 * Deserializer is used to read and write values from a buffer.
 */
export class Deserializer<T extends Record<string, any>> {
  private readonly values: Map<keyof T, FieldValue<any>> = new Map();
  private readonly reader: Reader;

  constructor(
    buffer: Buffer,
    private readonly fields: Map<keyof T, Field<keyof T, T[keyof T]>>,
  ) {
    this.reader = Reader.create(buffer);
  }

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
      const value = field.read(this.reader) as V;
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

  setValue<K extends keyof T>(name: K, value: T[K]): void {
    const field = this.fields.get(name);
    if (!field) {
      throw new Error(`Field ${name.toString()} not found`);
    }

    // Get the current value of the field in order to know the position and length
    const fieldValue = this.getFieldValue(field as Field<K, T[K]>);

    // Create writer for writing the new value to a new buffer
    const writer = Writer.create();
    field.write(writer, value);
    const data = writer.finish();

    // Create new buffer with the new value
    const buffer = Buffer.concat([
      this.reader.buf.subarray(0, fieldValue.position),
      data,
      this.reader.buf.subarray(fieldValue.position + fieldValue.length),
    ]);

    // Calculate the difference in length between the new value and the old value
    const lengthDifference = data.length - fieldValue.length;

    // Update reader
    this.reader.buf = buffer;
    this.reader.pos = this.reader.pos + lengthDifference;
    this.reader.len = this.reader.buf.length;

    // Update existing field value with the new value
    fieldValue.value = value;
    fieldValue.length = data.length;

    if (field.next && lengthDifference !== 0) {
      // Push the values of next fields down
      this.pushValues(field.next as Field<string>, lengthDifference);
    }
  }

  getBuffer(): Buffer {
    return Buffer.from(this.reader.buf);
  }

  private pushValues<K extends Field<string>>(
    field: K,
    lengthDifference: number,
  ): void {
    const fieldValue = this.values.get(field.name);
    if (!fieldValue) {
      // No field value. This means that the field was not read yet, so we don't
      // need to push the values
      return;
    }

    fieldValue.position += lengthDifference;

    if (field.next) {
      this.pushValues(field.next as Field<string>, lengthDifference);
    }
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

builder.addField(
  "version",
  (reader) => {
    return reader.uint32();
  },
  (writer, value) => {
    writer.uint32(value);
  },
);

builder.addField(
  "id",
  (reader) => {
    return reader.string();
  },
  (writer, value) => {
    return writer.string(value);
  },
);

builder.addField(
  "destinations",
  (reader) => {
    const count = reader.uint32();

    const destinations: number[] = [];
    for (let i = 0; i < count; i++) {
      destinations.push(reader.uint32());
    }

    return destinations;
  },
  (writer, value) => {
    writer.uint32(value.length);
    for (const destination of value) {
      writer.uint32(destination);
    }
  },
);

builder.addField(
  "source",
  (reader) => {
    return reader.uint32();
  },
  (writer, value) => {
    writer.uint32(value);
  },
);

builder.addField(
  "type",
  (reader) => {
    return reader.uint32();
  },
  (writer, value) => {
    writer.uint32(value);
  },
);

builder.addField(
  "payload",
  (reader) => {
    return Buffer.from(reader.bytes());
  },
  (writer, value) => {
    writer.bytes(value);
  },
);

builder.addField(
  "timestamp",
  (reader) => {
    const timestamp = reader.uint64();
    return new Long(timestamp.low, timestamp.high, timestamp.unsigned);
  },
  (writer, value) => {
    writer.uint64(value);
  },
);

export function messageSerializer(data: Buffer) {
  return builder.build(data);
}
