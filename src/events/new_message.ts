import {
  _intoIdSet,
  DefaultEventInterface,
  EventBuilder,
  EventCommon,
} from "./common.ts";
import type { Entity, EntityLike } from "../define.d.ts";
import type { TelegramClient } from "../client/telegram_client.ts";
import { Api } from "../tl/api.js";
import { LogLevel } from "../extensions/logger.ts";
import { BigInteger } from "deps.ts";

export interface NewMessageInterface extends DefaultEventInterface {
  func?: { (event: NewMessageEvent): boolean };
  incoming?: boolean;
  outgoing?: boolean;
  fromUsers?: EntityLike[];
  forwards?: boolean;
  pattern?: RegExp;
}

export class NewMessage extends EventBuilder {
  declare func?: { (event: NewMessageEvent): boolean };
  incoming?: boolean;
  outgoing?: boolean;
  fromUsers?: EntityLike[];
  forwards?: boolean;
  pattern?: RegExp;

  /** @hidden */
  private readonly _noCheck: boolean;

  constructor(newMessageParams: NewMessageInterface = {}) {
    let {
      chats,
      func,
      incoming,
      outgoing,
      fromUsers,
      forwards,
      pattern,
      blacklistChats = false,
    } = newMessageParams;
    if (incoming && outgoing) {
      incoming = outgoing = undefined;
    } else if (incoming != undefined && outgoing == undefined) {
      outgoing = !incoming;
    } else if (outgoing != undefined && incoming == undefined) {
      incoming = !outgoing;
    } else if (outgoing == false && incoming == false) {
      throw new Error(
        "Don't create an event handler if you don't want neither incoming nor outgoing!",
      );
    }
    super({ chats, blacklistChats, func });
    this.incoming = incoming;
    this.outgoing = outgoing;
    this.fromUsers = fromUsers;
    this.forwards = forwards;
    this.pattern = pattern;
    this._noCheck = [
      incoming,
      outgoing,
      chats,
      pattern,
      fromUsers,
      forwards,
      func,
    ].every((v) => v == undefined);
  }

  async _resolve(client: TelegramClient) {
    await super._resolve(client);
    this.fromUsers = await _intoIdSet(client, this.fromUsers);
  }

  build(
    update: Api.TypeUpdate | Api.TypeUpdates,
    _callback: undefined,
    selfId: BigInteger,
  ) {
    if (
      update instanceof Api.UpdateNewMessage ||
      update instanceof Api.UpdateNewChannelMessage
    ) {
      if (!(update.message instanceof Api.Message)) {
        return undefined;
      }
      const event = new NewMessageEvent(update.message, update);
      this.addAttributes(event);
      return event;
    } else if (update instanceof Api.UpdateShortMessage) {
      return new NewMessageEvent(
        new Api.Message({
          out: update.out,
          mentioned: update.mentioned,
          mediaUnread: update.mediaUnread,
          silent: update.silent,
          id: update.id,
          peerId: new Api.PeerUser({ userId: update.userId }),
          fromId: new Api.PeerUser({
            userId: update.out ? selfId : update.userId,
          }),
          message: update.message,
          date: update.date,
          fwdFrom: update.fwdFrom,
          viaBotId: update.viaBotId,
          replyTo: update.replyTo,
          entities: update.entities,
          ttlPeriod: update.ttlPeriod,
        }),
        update,
      );
    } else if (update instanceof Api.UpdateShortChatMessage) {
      return new NewMessageEvent(
        new Api.Message({
          out: update.out,
          mentioned: update.mentioned,
          mediaUnread: update.mediaUnread,
          silent: update.silent,
          id: update.id,
          peerId: new Api.PeerChat({ chatId: update.chatId }),
          fromId: new Api.PeerUser({
            userId: update.out ? selfId : update.fromId,
          }),
          message: update.message,
          date: update.date,
          fwdFrom: update.fwdFrom,
          viaBotId: update.viaBotId,
          replyTo: update.replyTo,
          entities: update.entities,
          ttlPeriod: update.ttlPeriod,
        }),
        update,
      );
    }
  }

  filter(event: NewMessageEvent) {
    if (this._noCheck) {
      return event;
    }
    if (this.incoming && event.message.out) {
      return;
    }
    if (this.outgoing && !event.message.out) {
      return;
    }
    if (this.forwards != undefined) {
      if (this.forwards != !!event.message.fwdFrom) {
        return;
      }
    }

    if (this.fromUsers != undefined) {
      if (
        !event.message.senderId ||
        !this.fromUsers.includes(event.message.senderId.toString())
      ) {
        return;
      }
    }

    if (this.pattern) {
      const match = event.message.message?.match(this.pattern);
      if (!match) {
        return;
      }
      event.message.patternMatch = match;
    }
    return super.filter(event);
  }

  // deno-lint-ignore no-explicit-any
  addAttributes(_update: any) {
    //update.patternMatch =
  }
}

export class NewMessageEvent extends EventCommon {
  message: Api.Message;
  originalUpdate: (Api.TypeUpdate | Api.TypeUpdates) & {
    _entities?: Map<number, Entity>;
  };

  constructor(
    message: Api.Message,
    originalUpdate: Api.TypeUpdate | Api.TypeUpdates,
  ) {
    super({
      msgId: message.id,
      chatPeer: message.peerId,
      broadcast: message.post,
    });
    this.originalUpdate = originalUpdate;
    this.message = message;
  }

  _setClient(client: TelegramClient) {
    super._setClient(client);
    const m = this.message;
    try {
      // todo make sure this never fails
      m._finishInit(
        client,
        this.originalUpdate._entities || new Map(),
        undefined,
      );
    } catch (e) {
      client._log.error(
        "Got error while trying to finish init message with id " + m.id,
      );
      if (client._log.canSend(LogLevel.ERROR)) {
        console.error(e);
      }
    }
  }
}
