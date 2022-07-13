import { convertToLittle, generateRandomBytes } from "../helpers.ts";
import { Buffer, IGE as IGE_ } from "deps.ts";

export class IGE {
  // deno-lint-ignore no-explicit-any
  private ige: any;

  constructor(key: Buffer, iv: Buffer) {
    this.ige = new IGE_(key, iv);
  }

  decryptIge(cipherText: Buffer): Buffer {
    return convertToLittle(this.ige.decrypt(cipherText));
  }

  encryptIge(plainText: Buffer): Buffer {
    const padding = plainText.length % 16;
    if (padding) {
      plainText = Buffer.concat([plainText, generateRandomBytes(16 - padding)]);
    }
    return convertToLittle(this.ige.encrypt(plainText));
  }
}
