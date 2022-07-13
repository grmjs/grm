import { Api } from "../tl/api.js";
import { EntityLike } from "../define.d.ts";
import { DefaultEventInterface, EventBuilder, EventCommon } from "./common.ts";
import { BigInteger } from "deps.ts";

export class DeletedMessage extends EventBuilder {
  constructor(eventParams: DefaultEventInterface) {
    super(eventParams);
  }

  build(
    update: Api.TypeUpdate | Api.TypeUpdates,
    _callback: undefined,
    _selfId: BigInteger,
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
  peer?: EntityLike;

  constructor(deletedIds: number[], peer?: EntityLike) {
    super({
      chatPeer: peer,
      msgId: Array.isArray(deletedIds) ? deletedIds[0] : 0,
    });
    this.deletedIds = deletedIds;
    this.peer = peer;
  }
}
