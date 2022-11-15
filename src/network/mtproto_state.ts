// deno-lint-ignore-file no-explicit-any
import { Api } from "../tl/api.js";
import { GZIPPacked } from "../tl/core/gzip_packed.ts";
import { TLMessage } from "../tl/core/tl_message.ts";
import { AuthKey } from "../crypto/authkey.ts";
import { IGE } from "../crypto/ige.ts";
import {
  generateRandomBytes,
  generateRandomLong,
  mod,
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha256,
  toSignedLittleBuffer,
} from "../helpers.ts";
import { BinaryReader } from "../extensions/binary_reader.ts";
import type { BinaryWriter } from "../extensions/binary_writer.ts";
import { InvalidBufferError, SecurityError } from "../errors/mod.ts";
import { bigInt, Buffer } from "../../deps.ts";

export class MTProtoState {
  private readonly authKey?: AuthKey;
  private _log: any;
  timeOffset: number;
  salt: bigInt.BigInteger;
  private id: bigInt.BigInteger;
  _sequence: number;
  private _lastMsgId: bigInt.BigInteger;
  private msgIds: string[];
  private securityChecks: boolean;

  constructor(authKey?: AuthKey, loggers?: any, securityChecks = true) {
    this.authKey = authKey;
    this._log = loggers;
    this.timeOffset = 0;
    this.salt = bigInt.zero;
    this._sequence = 0;
    this.id = this._lastMsgId = bigInt.zero;
    this.msgIds = [];
    this.securityChecks = securityChecks;
    this.reset();
  }

  reset() {
    this.id = generateRandomLong(true);
    this._sequence = 0;
    this._lastMsgId = bigInt.zero;
    this.msgIds = [];
  }

  updateMessageId(message: any) {
    message.msgId = this._getNewMsgId();
  }

 async _calcKey(authKey: Buffer, msgKey: Buffer, client: boolean) {
    const x = client ? 0 : 8;
    const sha256a =await sha256(Buffer.concat([msgKey, authKey.slice(x, x + 36)]));
    const sha256b =await sha256(
      Buffer.concat([authKey.slice(x + 40, x + 76), msgKey]),
    );

    const key = Buffer.concat([
      sha256a.slice(0, 8),
      sha256b.slice(8, 24),
      sha256a.slice(24, 32),
    ]);
    const iv = Buffer.concat([
      sha256b.slice(0, 8),
      sha256a.slice(8, 24),
      sha256b.slice(24, 32),
    ]);
    return { key, iv };
  }

  async writeDataAsMessage(
    buffer: BinaryWriter,
    data: Buffer,
    contentRelated: boolean,
    afterId?: bigInt.BigInteger,
  ) {
    const msgId = this._getNewMsgId();
    const seqNo = this._getSeqNo(contentRelated);
    let body;
    if (!afterId) {
      body = await GZIPPacked.gzipIfSmaller(contentRelated, data);
    } else {
      body = await GZIPPacked.gzipIfSmaller(
        contentRelated,
        new Api.InvokeAfterMsg({
          msgId: afterId,
          query: {
            getBytes() {
              return data;
            },
          },
        }).getBytes(),
      );
    }
    const s = Buffer.alloc(4);
    s.writeInt32LE(seqNo, 0);
    const b = Buffer.alloc(4);
    b.writeInt32LE(body.length, 0);
    const m = toSignedLittleBuffer(msgId, 8);
    buffer.write(Buffer.concat([m, s, b]));
    buffer.write(body);
    return msgId;
  }

  async encryptMessageData(data: Buffer) {
    if (!this.authKey) {
      throw new Error("Auth key unset");
    }

    await this.authKey.waitForKey();
    const authKey = this.authKey.getKey();
    if (!authKey) {
      throw new Error("Auth key unset");
    }

    if (!this.salt || !this.id || !authKey || !this.authKey.keyId) {
      throw new Error("Unset params");
    }
    const s = toSignedLittleBuffer(this.salt, 8);
    const i = toSignedLittleBuffer(this.id, 8);
    data = Buffer.concat([Buffer.concat([s, i]), data]);
    const padding = generateRandomBytes(
      mod(-(data.length + 12), 16) + 12,
    );
    // Being substr(what, offset, length); x = 0 for client
    // "msg_key_large = SHA256(substr(auth_key, 88+x, 32) + pt + padding)"
    const msgKeyLarge =await sha256(
      Buffer.concat([authKey.slice(88, 88 + 32), data, padding]),
    );
    // "msg_key = substr (msg_key_large, 8, 16)"
    const msgKey = msgKeyLarge.slice(8, 24);

    const { iv, key } = await this._calcKey(authKey, msgKey, true);

    const keyId = readBufferFromBigInt(this.authKey.keyId, 8);
    return Buffer.concat([
      keyId,
      msgKey,
      new IGE(key, iv).encryptIge(Buffer.concat([data, padding])),
    ]);
  }

  async decryptMessageData(body: Buffer) {
    if (!this.authKey) {
      throw new Error("Auth key unset");
    }

    if (body.length < 8) {
      throw new InvalidBufferError(body);
    }

    // TODO Check salt,sessionId, and sequenceNumber
    const keyId = readBigIntFromBuffer(body.slice(0, 8));
    if (!this.authKey.keyId || keyId.neq(this.authKey.keyId)) {
      throw new SecurityError("Server replied with an invalid auth key");
    }
    const authKey = this.authKey.getKey();
    if (!authKey) {
      throw new SecurityError("Unset AuthKey");
    }
    const msgKey = body.slice(8, 24);
    const { iv, key } = await this._calcKey(authKey, msgKey, false);
    body = new IGE(key, iv).decryptIge(body.slice(24));

    // https://core.telegram.org/mtproto/security_guidelines
    // Sections "checking sha256 hash" and "message length"

    const ourKey = await sha256(
      Buffer.concat([authKey.slice(96, 96 + 32), body]),
    );

    if (!msgKey.equals(ourKey.slice(8, 24))) {
      throw new SecurityError(
        "Received msg_key doesn't match with expected one",
      );
    }

    const reader = new BinaryReader(body);
    reader.readLong(); // removeSalt
    const serverId = reader.readLong();
    if (serverId.neq(this.id)) {
      // throw new SecurityError('Server replied with a wrong session ID');
    }

    const remoteMsgId = reader.readLong();
    if (
      this.msgIds.includes(remoteMsgId.toString()) &&
      this.securityChecks
    ) {
      throw new SecurityError("Duplicate msgIds");
    }
    if (this.msgIds.length > 500) {
      this.msgIds.shift();
    }
    this.msgIds.push(remoteMsgId.toString());
    const remoteSequence = reader.readInt();
    reader.readInt();
    const obj = reader.tgReadObject();

    return new TLMessage(remoteMsgId, remoteSequence, obj);
  }

  _getNewMsgId() {
    const now = new Date().getTime() / 1000 + this.timeOffset;
    const nanoseconds = Math.floor((now - Math.floor(now)) * 1e9);
    let newMsgId = bigInt(Math.floor(now))
      .shiftLeft(bigInt(32))
      .or(bigInt(nanoseconds).shiftLeft(bigInt(2)));
    if (this._lastMsgId.greaterOrEquals(newMsgId)) {
      newMsgId = this._lastMsgId.add(bigInt(4));
    }
    this._lastMsgId = newMsgId;
    return newMsgId;
  }

  updateTimeOffset(correctMsgId: bigInt.BigInteger) {
    const bad = this._getNewMsgId();
    const old = this.timeOffset;
    const now = Math.floor(new Date().getTime() / 1000);
    const correct = correctMsgId.shiftRight(bigInt(32)).toJSNumber();
    this.timeOffset = correct - now;

    if (this.timeOffset !== old) {
      this._lastMsgId = bigInt.zero;
      this._log.debug(
        `Updated time offset (old offset ${old}, bad ${bad}, good ${correctMsgId}, new ${this.timeOffset})`,
      );
    }

    return this.timeOffset;
  }

  _getSeqNo(contentRelated: boolean) {
    if (contentRelated) {
      const result = this._sequence * 2 + 1;
      this._sequence += 1;
      return result;
    } else {
      return this._sequence * 2;
    }
  }
}
