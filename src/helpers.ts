import { bigInt, Buffer } from "../deps.ts";
import { createHash, randomBytes } from "./crypto/crypto.ts";

export function readBigIntFromBuffer(
  buffer: Buffer,
  little = true,
  signed = false,
) {
  let randomBuffer = Buffer.from(buffer);
  const bytesLength = randomBuffer.length;

  if (little) {
    randomBuffer = randomBuffer.reverse();
  }

  let bigIntVar = bigInt(randomBuffer.toString("hex"), 16);

  if (signed && Math.floor(bigIntVar.toString(2).length / 8) >= bytesLength) {
    bigIntVar = bigIntVar.subtract(bigInt(2).pow(bigInt(bytesLength * 8)));
  }

  return bigIntVar;
}

export function generateRandomBigInt() {
  return readBigIntFromBuffer(generateRandomBytes(8), false);
}

export function escapeRegex(str: string) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

export function generateRandomBytes(count: number) {
  return Buffer.from(randomBytes(count));
}

// deno-lint-ignore ban-types
export function groupBy(list: unknown[], keyGetter: Function) {
  const map = new Map();
  list.forEach((item) => {
    const key = keyGetter(item);
    const collection = map.get(key) as Array<typeof item>;

    if (!collection) {
      map.set(key, [item]);
    } else {
      collection.push(item);
    }
  });
  return map;
}

export function betterConsoleLog(object: { [key: string]: unknown }) {
  const toPrint: { [key: string]: unknown } = {};
  for (const key in object) {
    // deno-lint-ignore no-prototype-builtins
    if (object.hasOwnProperty(key)) {
      if (!key.startsWith("_") && key !== "originalArgs") {
        toPrint[key] = object[key];
      }
    }
  }
  return toPrint;
}

// deno-lint-ignore no-explicit-any
export function isArrayLike<T>(x: any): x is Array<T> {
  return x &&
    typeof x.length === "number" &&
    typeof x !== "function" &&
    typeof x !== "string";
}

export function returnBigInt(
  num: bigInt.BigInteger | string | number | bigint,
) {
  if (bigInt.isInstance(num)) {
    return num;
  }
  if (typeof num === "number") {
    return bigInt(num);
  }
  if (typeof num === "bigint") {
    return bigInt(num);
  }

  return bigInt(num);
}

export function toSignedLittleBuffer(
  big: bigInt.BigInteger | string | number,
  number = 8,
) {
  const bigNumber = returnBigInt(big);
  const byteArray = new Array<bigInt.BigInteger>();

  for (let i = 0; i < number; i++) {
    byteArray[i] = bigNumber.shiftRight(8 * i).and(255);
  }

  return Buffer.from(byteArray as unknown as number[]);
}

export function readBufferFromBigInt(
  bigIntVar: bigInt.BigInteger,
  bytesNumber: number,
  little = true,
  signed = false,
) {
  bigIntVar = bigInt(bigIntVar);
  const bitLength = bigIntVar.bitLength().toJSNumber();

  const bytes = Math.ceil(bitLength / 8);

  if (bytesNumber < bytes) {
    throw new Error("OverflowError: int too big to convert");
  }

  if (!signed && bigIntVar.lesser(bigInt(0))) {
    throw new Error("Cannot convert to unsigned");
  }

  let below = false;
  if (bigIntVar.lesser(bigInt(0))) {
    below = true;
    bigIntVar = bigIntVar.abs();
  }

  const hex = bigIntVar.toString(16).padStart(bytesNumber * 2, "0");
  let littleBuffer = Buffer.from(hex, "hex");

  if (little) {
    littleBuffer = littleBuffer.reverse();
  }

  if (signed && below) {
    if (little) {
      let reminder = false;
      if (littleBuffer[0] !== 0) {
        littleBuffer[0] -= 1;
      }
      for (let i = 0; i < littleBuffer.length; i++) {
        if (littleBuffer[i] === 0) {
          reminder = true;
          continue;
        }
        if (reminder) {
          littleBuffer[i] -= 1;
          reminder = false;
        }
        littleBuffer[i] = 255 - littleBuffer[i];
      }
    } else {
      littleBuffer[littleBuffer.length - 1] = 256 -
        littleBuffer[littleBuffer.length - 1];
      for (let i = 0; i < littleBuffer.length - 1; i++) {
        littleBuffer[i] = 255 - littleBuffer[i];
      }
    }
  }
  return littleBuffer;
}

export function generateRandomLong(signed = true) {
  return readBigIntFromBuffer(generateRandomBytes(8), true, signed);
}

export function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function bigIntMod(
  n: bigInt.BigInteger,
  m: bigInt.BigInteger,
) {
  return n.remainder(m).add(m).remainder(m);
}

export function convertToLittle(buf: Buffer) {
  const correct = Buffer.alloc(buf.length * 4);

  for (let i = 0; i < buf.length; i++) {
    correct.writeUInt32BE(buf[i], i * 4);
  }
  return correct;
}

export function sha1(data: Buffer) {
  const shaSum = createHash("sha1");
  shaSum.update(data);
  return shaSum.digest();
}

export function sha256(data: Buffer) {
  const shaSum = createHash("sha256");
  shaSum.update(data);
  return shaSum.digest() ;
}

export async function generateKeyDataFromNonce(
  serverNonceBigInt: bigInt.BigInteger,
  newNonceBigInt: bigInt.BigInteger,
) {
  const serverNonce = toSignedLittleBuffer(serverNonceBigInt, 16);
  const newNonce = toSignedLittleBuffer(newNonceBigInt, 32);
  const [hash1, hash2, hash3] = await Promise.all([
    sha1(Buffer.concat([newNonce, serverNonce])),
    sha1(Buffer.concat([serverNonce, newNonce])),
    sha1(Buffer.concat([newNonce, newNonce])),
  ]);
  const keyBuffer = Buffer.concat([hash1, hash2.slice(0, 12)]);
  const ivBuffer = Buffer.concat([
    hash2.slice(12, 20),
    hash3,
    newNonce.slice(0, 4),
  ]);
  return {
    key: keyBuffer,
    iv: ivBuffer,
  };
}

let crcTable: number[] | undefined;

// Taken from https://stackoverflow.com/questions/18638900/javascript-crc32/18639999#18639999
function makeCRCTable() {
  let c: number;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

export function crc32(buf: Buffer | string) {
  if (!crcTable) {
    crcTable = makeCRCTable();
  }

  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf);
  }

  let crc = -1;

  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ -1) >>> 0;
}

export function modExp(
  a: bigInt.BigInteger,
  b: bigInt.BigInteger,
  n: bigInt.BigInteger,
): bigInt.BigInteger {
  a = a.remainder(n);
  let result = bigInt.one;
  let x = a;
  while (b.greater(bigInt.zero)) {
    const leastSignificantBit = b.remainder(bigInt(2));
    b = b.divide(bigInt(2));
    if (leastSignificantBit.eq(bigInt.one)) {
      result = result.multiply(x);
      result = result.remainder(n);
    }
    x = x.multiply(x);
    x = x.remainder(n);
  }
  return result;
}

export function getByteArray(
  integer: bigInt.BigInteger | number,
  signed = false,
) {
  const bits = integer.toString(2).length;
  const byteLength = Math.floor((bits + 8 - 1) / 8);
  return readBufferFromBigInt(
    typeof integer === "number" ? bigInt(integer) : integer,
    byteLength,
    false,
    signed,
  );
}

export function getMinBigInt(
  arrayOfBigInts: (bigInt.BigInteger | string)[],
): bigInt.BigInteger {
  if (arrayOfBigInts.length === 0) {
    return bigInt.zero;
  }
  if (arrayOfBigInts.length === 1) {
    return returnBigInt(arrayOfBigInts[0]);
  }
  let smallest = returnBigInt(arrayOfBigInts[0]);
  for (let i = 1; i < arrayOfBigInts.length; i++) {
    if (returnBigInt(arrayOfBigInts[i]).lesser(smallest)) {
      smallest = returnBigInt(arrayOfBigInts[i]);
    }
  }
  return smallest;
}

export function getRandomInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function bufferXor(a: Buffer, b: Buffer) {
  const res = [];
  for (let i = 0; i < a.length; i++) {
    res.push(a[i] ^ b[i]);
  }
  return Buffer.from(res);
}

export class TotalList<T> extends Array<T> {
  public total?: number;

  constructor() {
    super();
    this.total = 0;
  }
}
