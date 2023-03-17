import { Api } from "../tl/api.js";
import { DefaultEventInterface, EventBuilder, EventCommon } from "./common.ts";
import { bigInt } from "../deps.ts";

export class DeletedMessage extends EventBuilder {
  constructor(eventParams: DefaultEventInterface) {
    super(eventParams);
  }

  build(
    update: Api.TypeUpdate | Api.TypeUpdates,
    _callback: undefined,
    _selfId: bigInt.BigInteger,
  ) {
    if (update instanceof Api.UpdateDeleteChannelMessages) {
      return new DeletedMessageEvent(
        update.messages,
        new Api.PeerChannel({ channelId: update.channelId }),
      );
    } else if (update instanceof Api.UpdateDeleteMessages) {
      return new DeletedMessageEvent(update.messages);
    }
  }
}

export class DeletedMessageEvent extends EventCommon {
  deletedIds: number[];
  peer?: Api.TypeEntityLike;

  constructor(deletedIds: number[], peer?: Api.TypeEntityLike) {
    super({
      chatPeer: peer,
      msgId: Array.isArray(deletedIds) ? deletedIds[0] : 0,
    });
    this.deletedIds = deletedIds;
    this.peer = peer;
  }
}
