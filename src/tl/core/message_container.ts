// deno-lint-ignore-file no-explicit-any
import { TLMessage } from "./tl_message.ts";
import type { BinaryReader } from "../../extensions/binary_reader.ts";

export class MessageContainer {
  static CONSTRUCTOR_ID = 0x73f1f8dc;
  static classType = "constructor";
  static MAXIMUM_SIZE = 1044456 - 8;
  static MAXIMUM_LENGTH = 100;
  private CONSTRUCTOR_ID: number;
  private messages: any[];
  private classType: string;

  constructor(messages: any[]) {
    this.CONSTRUCTOR_ID = 0x73f1f8dc;
    this.messages = messages;
    this.classType = "constructor";
  }

  static fromReader(reader: BinaryReader) {
    const messages = [];
    const length = reader.readInt();
    for (let x = 0; x < length; x++) {
      const msgId = reader.readLong();
      const seqNo = reader.readInt();
      const length = reader.readInt();
      const before = reader.tellPosition();
      const obj = reader.tgReadObject();
      reader.setPosition(before + length);
      const tlMessage = new TLMessage(msgId, seqNo, obj);
      messages.push(tlMessage);
    }
    return new MessageContainer(messages);
  }
}
