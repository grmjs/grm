// deno-lint-ignore-file no-explicit-any
import { Buffer } from "../../deps.ts";
import { createCipheriv } from "../crypto/mod.ts";

export class CTR {
  private cipher: any;

  constructor(key: Buffer, iv: Buffer) {
    if (!Buffer.isBuffer(key) || !Buffer.isBuffer(iv) || iv.length !== 16) {
      throw new Error("Key and iv need to be a buffer");
    }
    this.cipher = createCipheriv("AES-256-CTR", key, iv);
  }

  encrypt(data: any) {
    return Buffer.from(this.cipher.update(data));
  }
}
