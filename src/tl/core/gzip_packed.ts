import { serializeBytes } from "../generation_helpers.ts";
import type { BinaryReader } from "../../extensions/binary_reader.ts";
import { Buffer, inflate } from "deps";

export class GZIPPacked {
  static CONSTRUCTOR_ID = 0x3072cfa1;
  static classType = "constructor";
  data: Buffer;
  private CONSTRUCTOR_ID: number;
  private classType: string;

  constructor(data: Buffer) {
    this.data = data;
    this.CONSTRUCTOR_ID = 0x3072cfa1;
    this.classType = "constructor";
  }

  static async gzipIfSmaller(contentRelated: boolean, data: Buffer) {
    if (contentRelated && data.length > 512) {
      const gzipped = await new GZIPPacked(data).toBytes();
      if (gzipped.length < data.length) {
        return gzipped;
      }
    }
    return data;
  }

  static gzip(input: Buffer) {
    return Buffer.from(input);
    // TODO this usually makes it faster for large requests
    // return Buffer.from(deflate(input, { level: 9, gzip: true }))
  }

  static ungzip(input: Buffer) {
    return Buffer.from(inflate(input));
  }

  toBytes() {
    const g = Buffer.alloc(4);
    g.writeUInt32LE(GZIPPacked.CONSTRUCTOR_ID, 0);
    return Buffer.concat([
      g,
      serializeBytes(GZIPPacked.gzip(this.data)),
    ]);
  }

  static read(reader: BinaryReader) {
    const constructor = reader.readInt(false);
    if (constructor !== GZIPPacked.CONSTRUCTOR_ID) {
      throw new Error("not equal");
    }
    return GZIPPacked.gzip(reader.tgReadBytes());
  }

  static fromReader(reader: BinaryReader) {
    const data = reader.tgReadBytes();
    return new GZIPPacked(GZIPPacked.ungzip(data));
  }
}
