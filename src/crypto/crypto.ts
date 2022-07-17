import { ab2i, i2ab } from "./converters.ts";
import { AES, Buffer, getWords } from "../../deps.ts";

export class Counter {
  _counter: Buffer;

  // deno-lint-ignore no-explicit-any
  constructor(initialValue: any) {
    this._counter = Buffer.from(initialValue);
  }

  increment() {
    for (let i = 15; i >= 0; i--) {
      if (this._counter[i] === 255) {
        this._counter[i] = 0;
      } else {
        this._counter[i]++;
        break;
      }
    }
  }
}

export class CTR {
  private _counter: Counter;
  private _remainingCounter?: Buffer;
  private _remainingCounterIndex: number;
  private _aes: AES;

  // deno-lint-ignore no-explicit-any
  constructor(key: Buffer, counter: any) {
    if (!(counter instanceof Counter)) {
      counter = new Counter(counter);
    }

    this._counter = counter;
    this._remainingCounter = undefined;
    this._remainingCounterIndex = 16;
    this._aes = new AES(getWords(key));
  }

  // deno-lint-ignore no-explicit-any
  update(plainText: any) {
    return this.encrypt(plainText);
  }

  // deno-lint-ignore no-explicit-any
  encrypt(plainText: any) {
    const encrypted = Buffer.from(plainText);

    for (let i = 0; i < encrypted.length; i++) {
      if (this._remainingCounterIndex === 16) {
        this._remainingCounter = Buffer.from(
          i2ab(this._aes.encrypt(ab2i(this._counter._counter))),
        );
        this._remainingCounterIndex = 0;
        this._counter.increment();
      }
      if (this._remainingCounter) {
        encrypted[i] ^= this._remainingCounter[this._remainingCounterIndex++];
      }
    }

    return encrypted;
  }
}

export function createDecipheriv(algorithm: string, key: Buffer, iv: Buffer) {
  if (algorithm.includes("ECB")) {
    throw new Error("Not supported");
  } else {
    return new CTR(key, iv);
  }
}

export function createCipheriv(algorithm: string, key: Buffer, iv: Buffer) {
  if (algorithm.includes("ECB")) {
    throw new Error("Not supported");
  } else {
    return new CTR(key, iv);
  }
}

export function randomBytes(count: number) {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}
export class Hash {
  private readonly algorithm: string;
  private data?: Uint8Array;

  constructor(algorithm: string) {
    this.algorithm = algorithm;
  }

  update(data: Buffer) {
    // We shouldn't be needing new Uint8Array but it doesn't
    // work without it
    this.data = new Uint8Array(data);
  }

  async digest() {
    if (this.data) {
      if (this.algorithm === "sha1") {
        return Buffer.from(
          await self.crypto.subtle.digest("SHA-1", this.data),
        );
      } else if (this.algorithm === "sha256") {
        return Buffer.from(
          await self.crypto.subtle.digest("SHA-256", this.data),
        );
      }
    }
    return Buffer.alloc(0);
  }
}

export async function pbkdf2Sync(
  // deno-lint-ignore no-explicit-any
  password: any,
  // deno-lint-ignore no-explicit-any
  salt: any,
  // deno-lint-ignore no-explicit-any
  iterations: any,
  // deno-lint-ignore no-explicit-any
  ..._args: any[]
) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    password,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  return Buffer.from(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-512",
        salt,
        iterations,
      },
      passwordKey,
      512,
    ),
  );
}

export function createHash(algorithm: string) {
  return new Hash(algorithm);
}
