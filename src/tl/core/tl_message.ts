import { BigInteger } from "deps";

export class TLMessage {
  static SIZE_OVERHEAD = 12;
  static classType = "constructor";
  private classType = "constructor";

  constructor(
    public msgId: BigInteger,
    private seqNo: number,
    // deno-lint-ignore no-explicit-any
    public obj: any,
  ) {
  }
}
