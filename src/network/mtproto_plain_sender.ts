import { MTProtoState } from "./mtproto_state.ts";
import { Api } from "../tl/api.js";
import { toSignedLittleBuffer } from "../helpers.ts";
import { InvalidBufferError } from "../errors/mod.ts";
import { BinaryReader } from "../extensions/binary_reader.ts";
import type { Connection } from "./connection/connection.ts";
import { Buffer } from "deps";

export class MTProtoPlainSender {
  private _state: MTProtoState;
  private _connection: Connection;

  // deno-lint-ignore no-explicit-any
  constructor(connection: any, loggers: any) {
    this._state = new MTProtoState(undefined, loggers);
    this._connection = connection;
  }

  async send(request: Api.AnyRequest) {
    let body = request.getBytes();
    let msgId = this._state._getNewMsgId();
    const m = toSignedLittleBuffer(msgId, 8);
    const b = Buffer.alloc(4);
    b.writeInt32LE(body.length, 0);

    const res = Buffer.concat([
      Buffer.concat([Buffer.alloc(8), m, b]),
      body,
    ]);
    await this._connection.send(res);
    body = await this._connection.recv();
    if (body.length < 8) throw new InvalidBufferError(body);

    const reader = new BinaryReader(body);
    const authKeyId = reader.readLong();
    if (authKeyId.neq(BigInt(0))) throw new Error("Bad authKeyId");

    msgId = reader.readLong();
    if (msgId.eq(BigInt(0))) throw new Error("Bad msgId");

    const length = reader.readInt();
    if (length <= 0) throw new Error("Bad length");
    return reader.tgReadObject();
  }
}
