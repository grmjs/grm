import { Api } from "../tl/api.js";
import { ChatGetter } from "../tl/custom/chat_getter.ts";
import { AbstractTelegramClient } from "../client/abstract_telegram_client.ts";
import { isArrayLike, returnBigInt } from "../helpers.ts";
import { getPeerId, parseID } from "../utils.ts";
import { SenderGetter } from "../tl/custom/sender_getter.ts";
import { bigInt } from "../../deps.ts";

export async function _intoIdSet(
  client: AbstractTelegramClient,
  chats: Api.TypeEntityLike[] | Api.TypeEntityLike | undefined,
): Promise<string[] | undefined> {
  if (chats == undefined) {
    return undefined;
  }
  if (!isArrayLike(chats)) {
    chats = [chats];
  }
  const result: Set<string> = new Set<string>();
  for (let chat of chats) {
    if (
      typeof chat == "number" ||
      typeof chat == "bigint" ||
      (typeof chat == "string" && parseID(chat)) ||
      bigInt.isInstance(chat)
    ) {
      chat = returnBigInt(chat);
      if (chat.lesser(0)) {
        result.add(chat.toString());
      } else {
        result.add(
          getPeerId(
            new Api.PeerUser({
              userId: chat,
            }),
          ),
        );
        result.add(
          getPeerId(
            new Api.PeerChat({
              chatId: chat,
            }),
          ),
        );
        result.add(
          getPeerId(
            new Api.PeerChannel({
              channelId: chat,
            }),
          ),
        );
      }
    } else if (
      typeof chat == "object" &&
      chat.SUBCLASS_OF_ID == 0x2d45687
    ) {
      result.add(getPeerId(chat));
    } else {
      chat = await client.getInputEntity(chat);
      if (chat instanceof Api.InputPeerSelf) {
        chat = await client.getMe(true);
      }
      result.add(getPeerId(chat));
    }
  }
  return Array.from(result);
}

export interface DefaultEventInterface {
  chats?: Api.TypeEntityLike[];
  blacklistChats?: boolean;
  func?: CallableFunction;
}

export class EventBuilder {
  chats?: string[];
  blacklistChats: boolean;
  resolved: boolean;
  func?: CallableFunction;
  client?: AbstractTelegramClient;

  constructor(eventParams: DefaultEventInterface) {
    this.chats = eventParams.chats?.map((x) => x.toString());
    this.blacklistChats = eventParams.blacklistChats || false;
    this.resolved = false;
    this.func = eventParams.func;
  }

  build(
    update: Api.TypeUpdate,
    _callback?: CallableFunction,
    _selfId?: bigInt.BigInteger,
    // deno-lint-ignore no-explicit-any
  ): any {
    if (update) return update;
  }

  async resolve(client: AbstractTelegramClient) {
    if (this.resolved) {
      return;
    }
    await this._resolve(client);
    this.resolved = true;
  }

  async _resolve(client: AbstractTelegramClient) {
    this.chats = await _intoIdSet(client, this.chats);
  }

  filter(
    event: EventCommon | EventCommonSender,
  ): undefined | EventCommon | EventCommonSender {
    if (!this.resolved) {
      return;
    }
    if (this.chats != undefined) {
      if (event.chatId == undefined) {
        return;
      }
      const inside = this.chats.includes(event.chatId.toString());
      if (inside == this.blacklistChats) {
        // If this chat matches but it's a blacklist ignore.
        // If it doesn't match but it's a whitelist ignore.
        return;
      }
    }
    if (this.func && !this.func(event)) {
      return;
    }
    return event;
  }
}

export interface EventCommonInterface {
  chatPeer?: Api.TypeEntityLike;
  msgId?: number;
  broadcast?: boolean;
}

export class EventCommon extends ChatGetter {
  _eventName = "Event";
  _entities: Map<string, Api.TypeEntity>;
  _messageId?: number;

  constructor({
    chatPeer = undefined,
    msgId = undefined,
    broadcast = undefined,
  }: EventCommonInterface) {
    super();
    ChatGetter.initChatClass(this, { chatPeer, broadcast });
    this._entities = new Map();
    this._client = undefined;
    this._messageId = msgId;
  }

  _setClient(client: AbstractTelegramClient) {
    this._client = client;
  }

  get client() {
    return this._client;
  }
}

export class EventCommonSender extends SenderGetter {
  _eventName = "Event";
  _entities: Map<string, Api.TypeEntity>;
  _messageId?: number;

  constructor({
    chatPeer = undefined,
    msgId = undefined,
    broadcast = undefined,
  }: EventCommonInterface) {
    super();
    ChatGetter.initChatClass(this, { chatPeer, broadcast });
    SenderGetter.initChatClass(this, { chatPeer, broadcast });
    this._entities = new Map();
    this._client = undefined;
    this._messageId = msgId;
  }

  _setClient(client: AbstractTelegramClient) {
    this._client = client;
  }

  get client() {
    return this._client;
  }
}
