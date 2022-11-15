import {
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha1,
  sleep,
  toSignedLittleBuffer,
} from "../helpers.ts";
import { BinaryReader } from "../extensions/binary_reader.ts";
import { bigInt, Buffer } from "../../deps.ts";

export class AuthKey {
  private _key?: Buffer;
  private _hash?: Buffer;
  private auxHash?: bigInt.BigInteger;
  keyId?: bigInt.BigInteger;

  constructor(value?: Buffer, hash?: Buffer) {
    if (!hash || !value) return;
    this._key = value;
    this._hash = hash;
    const reader = new BinaryReader(hash);
    this.auxHash = reader.readLong(false);
    reader.read(4);
    this.keyId = reader.readLong(false);
  }

  async setKey(value?: Buffer | AuthKey) {
    if (!value) {
      this._key =
        this.auxHash =
        this.keyId =
        this._hash =
          undefined;
      return;
    }
    if (value instanceof AuthKey) {
      this._key = value._key;
      this.auxHash = value.auxHash;
      this.keyId = value.keyId;
      this._hash = value._hash;
      return;
    }
    this._key = value;
    this._hash = await sha1(this._key);
    const reader = new BinaryReader(this._hash);
    this.auxHash = reader.readLong(false);
    reader.read(4);
    this.keyId = reader.readLong(false);
  }

  async waitForKey() {
    while (!this.keyId) {
      await sleep(20);
    }
  }

  getKey() {
    return this._key;
  }

  async calcNewNonceHash(
    newNonce: bigInt.BigInteger,
    number: number,
  ):Promise<bigInt.BigInteger> {
    if (this.auxHash) {
      const nonce = toSignedLittleBuffer(newNonce, 32);
      const n = Buffer.alloc(1);
      n.writeUInt8(number, 0);
      const data = Buffer.concat([
        nonce,
        Buffer.concat([n, readBufferFromBigInt(this.auxHash, 8, true)]),
      ]);
      const shaData = (await sha1(data)).slice(4, 20);
      return readBigIntFromBuffer(shaData, true, true);
    }
    throw new Error("Auth key not set");
  }

  equals(other: AuthKey) {
    return (
      other instanceof this.constructor &&
      this._key &&
      Buffer.isBuffer(other.getKey()) &&
      other.getKey()?.equals(this._key)
    );
  }
}
