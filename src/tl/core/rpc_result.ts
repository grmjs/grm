import { Api } from "../api.js";
import { GZIPPacked } from "./gzip_packed.ts";
import { BinaryReader } from "../../extensions/interfaces.ts";
import { bigInt, Buffer } from "../../deps.ts";

export class RPCResult {
  static CONSTRUCTOR_ID = 0xf35c6d01;
  static classType = "constructor";
  private CONSTRUCTOR_ID: number;
  private reqMsgId: bigInt.BigInteger;
  private body?: Buffer;
  private error?: Api.RpcError;
  private classType: string;

  constructor(
    reqMsgId: bigInt.BigInteger,
    body?: Buffer,
    error?: Api.RpcError,
  ) {
    this.CONSTRUCTOR_ID = 0xf35c6d01;
    this.reqMsgId = reqMsgId;
    this.body = body;
    this.error = error;
    this.classType = "constructor";
  }

  static fromReader(reader: BinaryReader) {
    const msgId = reader.readLong();
    const innerCode = reader.readInt(false);

    if (innerCode === Api.RpcError.CONSTRUCTOR_ID) {
      return new RPCResult(msgId, undefined, Api.RpcError.fromReader(reader));
    }

    if (innerCode === GZIPPacked.CONSTRUCTOR_ID) {
      return new RPCResult(msgId, (GZIPPacked.fromReader(reader)).data);
    }

    reader.seek(-4);
    return new RPCResult(msgId, reader.read(), undefined);
  }
}
