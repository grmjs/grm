// deno-lint-ignore-file no-explicit-any
import { BigInteger, Buffer } from "../../deps.ts";

export class RequestState {
  public containerId?: BigInteger;
  public msgId?: BigInteger;
  public request: any;
  public data: Buffer;
  public after: any;
  public result: undefined;
  promise: Promise<unknown>;
  // @ts-ignore mm
  public resolve: (value?: any) => void;
  // @ts-ignore mm2
  public reject: (reason?: any) => void;

  constructor(request: any, after = undefined) {
    this.containerId = undefined;
    this.msgId = undefined;
    this.request = request;
    this.data = request.getBytes();
    this.after = after;
    this.result = undefined;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
