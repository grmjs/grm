import { Api } from "../tl/api.js";
import {
  NewMessage,
  NewMessageEvent,
  NewMessageInterface,
} from "./new_message.ts";
import { BigInteger } from "../../deps.ts";

export interface EditedMessageInterface extends NewMessageInterface {
  func?: { (event: EditedMessageEvent): boolean };
}

export class EditedMessage extends NewMessage {
  declare func?: { (event: EditedMessageEvent): boolean };

  constructor(editedMessageParams: EditedMessageInterface) {
    super(editedMessageParams);
  }

  build(
    update: Api.TypeUpdate | Api.TypeUpdates,
    _callback: undefined,
    _selfId: BigInteger,
  ) {
    if (
      update instanceof Api.UpdateEditChannelMessage ||
      update instanceof Api.UpdateEditMessage
    ) {
      if (!(update.message instanceof Api.Message)) {
        return undefined;
      }
      const event = new EditedMessageEvent(update.message, update);
      this.addAttributes(event);
      return event;
    }
  }
}

export class EditedMessageEvent extends NewMessageEvent {
  constructor(
    message: Api.Message,
    originalUpdate: Api.TypeUpdate | Api.TypeUpdates,
  ) {
    super(message, originalUpdate);
  }
}
