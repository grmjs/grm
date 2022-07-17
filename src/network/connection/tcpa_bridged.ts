import { Connection, PacketCodec } from "./connection.ts";
import { readBufferFromBigInt } from "../../helpers.ts";
import type { PromisedNetSockets } from "../../extensions/promised_net_sockets.ts";
import type { PromisedWebSockets } from "../../extensions/promised_web_sockets.ts";
import { bigInt, Buffer } from "../../../deps.ts";

export class AbridgedPacketCodec extends PacketCodec implements PacketCodec {
  static tag = Buffer.from("ef", "hex");
  static obfuscateTag = Buffer.from("efefefef", "hex");
  private tag: Buffer;
  obfuscateTag: Buffer;

  // deno-lint-ignore no-explicit-any
  constructor(props: any) {
    super(props);
    this.tag = AbridgedPacketCodec.tag;
    this.obfuscateTag = AbridgedPacketCodec.obfuscateTag;
  }

  encodePacket(data: Buffer) {
    const length = data.length >> 2;
    let temp;
    if (length < 127) {
      const b = Buffer.alloc(1);
      b.writeUInt8(length, 0);
      temp = b;
    } else {
      temp = Buffer.concat([
        Buffer.from("7f", "hex"),
        readBufferFromBigInt(bigInt(length), 3),
      ]);
    }
    return Buffer.concat([temp, data]);
  }

  async readPacket(
    reader: PromisedNetSockets | PromisedWebSockets,
  ): Promise<Buffer> {
    const readData = await reader.read(1);
    let length = readData[0];
    if (length >= 127) {
      length = Buffer.concat([
        await reader.read(3),
        Buffer.alloc(1),
      ]).readInt32LE(0);
    }

    return reader.read(length << 2);
  }
}

export class ConnectionTCPAbridged extends Connection {
  PacketCodecClass = AbridgedPacketCodec;
}
