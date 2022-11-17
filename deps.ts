// std/
export {
  basename,
  dirname,
  fromFileUrl,
  join,
  resolve,
} from "https://deno.land/std@0.164.0/path/mod.ts";

// std/node/
export { Buffer } from "https://deno.land/std@0.164.0/node/buffer.ts";

// x/
export { getWords } from "https://deno.land/x/dryptography@v0.1.4/aes/utils/words.ts";

// cdn.skypack.dev/
export {
  Mutex,
  Semaphore,
} from "https://cdn.skypack.dev/async-mutex@v0.4.0?dts";
export {
  default as AES,
  IGE,
} from "https://cdn.skypack.dev/@cryptography/aes@0.1.1?dts";
export { inflate } from "https://cdn.skypack.dev/pako@v2.1.0?dts";
export { getExtension, getType } from "https://cdn.skypack.dev/mime?dts";
export { default as bigInt } from "https://cdn.skypack.dev/big-integer?dts";

// esm.sh/
export { w3cwebsocket } from "https://esm.sh/websocket@1.0.34";

// ghc.deno.dev/
export {
  type Handler,
  Parser,
} from "https://ghc.deno.dev/tbjgolden/deno-htmlparser2@1f76cdf/htmlparser2/Parser.ts";

export { type Socket } from "https://deno.land/std@0.164.0/node/net.ts";

import { type SocksClient as SocksClient_ } from "https://deno.land/x/deno_socks@v2.6.1/mod.ts";

export let SocksClient = null as unknown as typeof SocksClient_;

if (typeof document === "undefined") {
  SocksClient =
    (await import("https://deno.land/x/deno_socks@v2.6.1/mod.ts")).SocksClient;
}

export class WriteStream {
  constructor(public path: string, public file: Deno.FsFile) {
  }

  write(p: Uint8Array) {
    return this.file.write(p);
  }

  close() {
    this.file.close();
  }
}

export function createWriteStream(path: string) {
  return new WriteStream(
    path,
    Deno.openSync(path, { write: true, create: true }),
  );
}
