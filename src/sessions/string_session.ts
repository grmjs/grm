import { MemorySession } from "./memory_session.ts";
import { BinaryReader } from "../extensions/binary_reader.ts";
import { AuthKey } from "../crypto/authkey.ts";
import { Buffer } from "../../deps.ts";

const CURRENT_VERSION = "1";

export class StringSession extends MemorySession {
  _key?: Buffer;

  constructor(session?: string) {
    super();

    if (session) {
      if (session[0] !== CURRENT_VERSION) {
        throw new Error("Not a valid string");
      }

      session = session.slice(1);
      const r = StringSession.decode(session);
      const reader = new BinaryReader(r);
      this._dcId = reader.read(1).readUInt8(0);

      if (session.length === 352) {
        // Telethon session
        const ipv4 = reader.read(4);
        this._serverAddress = `${ipv4[0].toString()}.${ipv4[1].toString()}.\
${ipv4[2].toString()}.${ipv4[3].toString()}`;
      } else {
        const serverAddressLen = reader.read(2).readInt16BE(0);
        if (serverAddressLen > 100) {
          reader.offset -= 2;
          this._serverAddress = reader
            .read(16)
            .toString("hex")
            .match(/.{1,4}/g)!
            .map((val) => val.replace(/^0+/, ""))
            .join(":")
            .replace(/0000\:/g, ":")
            .replace(/:{2,}/g, "::");
        } else {
          this._serverAddress = reader.read(serverAddressLen).toString();
        }
      }
      this._port = reader.read(2).readInt16BE(0);
      this._key = reader.read(-1);
    }
  }

  static encode(x: Buffer) {
    return x.toString("base64");
  }

  static decode(x: string) {
    return Buffer.from(x, "base64");
  }

  async load() {
    if (this._key) {
      this._authKey = new AuthKey();
      await this._authKey.setKey(this._key);
    }
  }

  save() {
    if (!this.authKey || !this.serverAddress || !this.port) {
      return "";
    }

    const key = this.authKey.getKey();
    if (!key) return "";
    const dcBuffer = Buffer.from([this.dcId]);
    const addressBuffer = Buffer.from(this.serverAddress);
    const addressLengthBuffer = Buffer.alloc(2);
    addressLengthBuffer.writeInt16BE(addressBuffer.length, 0);
    const portBuffer = Buffer.alloc(2);
    portBuffer.writeInt16BE(this.port, 0);

    return (
      CURRENT_VERSION +
      StringSession.encode(
        Buffer.concat([
          dcBuffer,
          addressLengthBuffer,
          addressBuffer,
          portBuffer,
          key,
        ]),
      )
    );
  }
}
