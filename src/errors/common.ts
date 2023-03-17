import { Buffer } from "../deps.ts";

export class ReadCancelledError extends Error {
  constructor() {
    super("The read operation was cancelled.");
  }
}

export class TypeNotFoundError extends Error {
  constructor(public invalidConstructorId: number, public remaining: Buffer) {
    super(
      `Could not find a matching Constructor ID for the TLObject that was \
supposed to be read with ID ${invalidConstructorId}. Most likely, a TLObject \
was trying to be read when it should not be read. Remaining bytes: ${remaining.length}`,
    );
    console.warn(
      `Missing MTProto Entity: Please, make sure to add TL definition for ID ${invalidConstructorId}`,
    );
  }
}

export class InvalidChecksumError extends Error {
  constructor(private checksum: number, private validChecksum: number) {
    super(
      `Invalid checksum (${checksum} when ${validChecksum} was expected). This packet should be skipped.`,
    );
  }
}

export class InvalidBufferError extends Error {
  code?: number;

  // deno-lint-ignore constructor-super
  constructor(public payload: Buffer) {
    let code = undefined;
    if (payload.length === 4) {
      code = -payload.readInt32LE(0);
      super(`Invalid response buffer (HTTP code ${code})`);
    } else {
      super(`Invalid response buffer (too short ${payload})`);
    }
    this.code = code;
  }
}

export class SecurityError extends Error {
  // deno-lint-ignore no-explicit-any
  constructor(...args: any[]) {
    if (!args.length) args = ["A security check failed."];
    super(...args);
  }
}

export class CdnFileTamperedError extends SecurityError {
  constructor() {
    super("The CDN file has been altered and its download cancelled.");
  }
}
