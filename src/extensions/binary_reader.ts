import { TypeNotFoundError } from "../errors/mod.ts";
import { coreObjects } from "../tl/core/mod.ts";
import { tlObjects } from "../tl/all_tl_objects.ts";
import { readBigIntFromBuffer } from "../helpers.ts";
import { Buffer } from "deps.ts";

export class BinaryReader {
  private readonly stream: Buffer;
  private _last?: Buffer;
  offset: number;

  constructor(data: Buffer) {
    this.stream = data;
    this._last = undefined;
    this.offset = 0;
  }

  read(length = -1, checkLength = true) {
    if (length === -1) {
      length = this.stream.length - this.offset;
    }
    const result = this.stream.slice(this.offset, this.offset + length);
    this.offset += length;
    if (checkLength && result.length !== length) {
      throw Error(
        `No more data left to read (need ${length}, got ${result.length}: ${result}); last read ${this._last}`,
      );
    }
    this._last = result;
    return result;
  }

  readByte() {
    return this.read(1)[0];
  }

  readInt(signed = true) {
    let res;
    if (signed) {
      res = this.stream.readInt32LE(this.offset);
    } else {
      res = this.stream.readUInt32LE(this.offset);
    }
    this.offset += 4;
    return res;
  }

  readLargeInt(bits: number, signed = true) {
    const buffer = this.read(Math.floor(bits / 8));
    return readBigIntFromBuffer(buffer, true, signed);
  }

  readLong(signed = true) {
    return this.readLargeInt(64, signed);
  }

  readFloat() {
    return this.read(4).readFloatLE(0);
  }

  readDouble() {
    // was this a bug ? it should have been <d
    return this.read(8).readDoubleLE(0);
  }

  getBuffer() {
    return this.stream;
  }

  tgReadBytes() {
    const firstByte = this.readByte();
    let padding;
    let length;
    if (firstByte === 254) {
      length = this.readByte() |
        (this.readByte() << 8) |
        (this.readByte() << 16);
      padding = length % 4;
    } else {
      length = firstByte;
      padding = (length + 1) % 4;
    }
    const data = this.read(length);

    if (padding > 0) {
      padding = 4 - padding;
      this.read(padding);
    }

    return data;
  }

  tgReadString() {
    return this.tgReadBytes().toString("utf-8");
  }

  tgReadBool() {
    const value = this.readInt(false);
    if (value === 0x997275b5) {
      // boolTrue
      return true;
    } else if (value === 0xbc799737) {
      // boolFalse
      return false;
    } else {
      throw new Error(`Invalid boolean code ${value.toString(16)}`);
    }
  }
  tgReadDate() {
    const value = this.readInt();
    return new Date(value * 1000);
  }

  seek(offset: number) {
    this.offset += offset;
  }

  setPosition(position: number) {
    this.offset = position;
  }

  tellPosition() {
    return this.offset;
  }

  // deno-lint-ignore no-explicit-any
  tgReadObject(): any {
    const constructorId = this.readInt(false);

    let clazz = tlObjects[constructorId];
    if (clazz === undefined) {
      /**
       * The class was undefined, but there's still a
       * chance of it being a manually parsed value like bool!
       */
      const value = constructorId;
      if (value === 0x997275b5) {
        // boolTrue
        return true;
      } else if (value === 0xbc799737) {
        // boolFalse
        return false;
      } else if (value === 0x1cb5c415) {
        // Vector
        const temp = [];
        const length = this.readInt();
        for (let i = 0; i < length; i++) {
          temp.push(this.tgReadObject());
        }
        return temp;
      }

      clazz = coreObjects.get(constructorId);

      if (clazz === undefined) {
        // If there was still no luck, give up
        this.seek(-4); // Go back
        const pos = this.tellPosition();
        const error = new TypeNotFoundError(constructorId, this.read());
        this.setPosition(pos);
        throw error;
      }
    }
    return clazz.fromReader(this);
  }

  tgReadVector() {
    if (this.readInt(false) !== 0x1cb5c415) {
      throw new Error("Invalid constructor code, vector was expected");
    }
    const count = this.readInt();
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push(this.tgReadObject());
    }
    return temp;
  }
}
