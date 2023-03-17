import { bigInt, Buffer } from "../deps.ts";

export interface BinaryReader {
  offset: number;
  read(length?: number, checkLength?: boolean): Buffer;
  readByte(): number;
  readInt(signed?: boolean): number;
  readLargeInt(bits: number, signed?: boolean): bigInt.BigInteger;
  readLong(signed?: boolean): bigInt.BigInteger;
  readFloat(): number;
  readDouble(): number;
  getBuffer(): Buffer;
  tgReadBytes(): Buffer;
  tgReadString(): string;
  tgReadBool(): boolean;
  tgReadDate(): Date;
  seek(offset: number): void;
  setPosition(position: number): void;
  tellPosition(): number;
  // deno-lint-ignore no-explicit-any
  tgReadObject(): any;
  // deno-lint-ignore no-explicit-any
  tgReadVector(): any[];
}
