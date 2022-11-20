import { EventBuilder, EventCommonSender } from "./common.ts";
import { Api } from "../tl/api.js";
import { returnBigInt, toSignedLittleBuffer } from "../helpers.ts";
import { AbstractTelegramClient } from "../client/abstract_telegram_client.ts";
import { getInputPeer } from "../utils.ts";
import { getEntityPair_ } from "../entity_cache.ts";
import { EditMessageParams, SendMessageParams } from "../client/types.ts";
import { CustomMessage } from "../tl/custom/message.ts";

export interface NewCallbackQueryInterface {
  chats: Api.TypeEntityLike[];
  func?: { (event: CallbackQuery): boolean };
  fromUsers: Api.TypeEntityLike[];
  blacklistUsers: Api.TypeEntityLike[];
  pattern?: RegExp;
}

export const NewCallbackQueryDefaults: NewCallbackQueryInterface = {
  chats: [],
  fromUsers: [],
  blacklistUsers: [],
};

export class CallbackQuery extends EventBuilder {
  match?: RegExp;

  private _noCheck: boolean;

  constructor(inlineQueryParams: Partial<NewCallbackQueryInterface> = {}) {
    const { chats, func, pattern } = inlineQueryParams;
    super({ chats, func, blacklistChats: false });

    this.match = pattern;

    this._noCheck = [this.chats, this.func, this.match].every(
      (i) => i === null || i === undefined,
    );
  }

  build(
    update: Api.TypeUpdate | Api.TypeUpdates,
    _callback: undefined,
    _selfId = undefined,
  ) {
    if (update instanceof Api.UpdateBotCallbackQuery) {
      return new CallbackQueryEvent(update, update.peer, update.msgId);
    } else if (update instanceof Api.UpdateInlineBotCallbackQuery) {
      const b = toSignedLittleBuffer(update.msgId.id, 8);
      const msgId = b.readInt32LE(0);
      const peerId = b.readInt32LE(4);
      const peer = peerId < 0
        ? new Api.PeerChannel({ channelId: returnBigInt(-peerId) })
        : new Api.PeerUser({ userId: returnBigInt(peerId) });
      return new CallbackQueryEvent(update, peer, msgId);
    }
  }

  filter(event: CallbackQueryEvent) {
    if (this._noCheck) return event;

    if (this.chats) {
      let inside = this.chats.includes(
        event.query.chatInstance.toString(),
      );
      if (event.chatId) {
        inside = inside || this.chats.includes(event.chatId.toString());
      }

      if (inside === this.blacklistChats) {
        return;
      }
    }

    if (this.match) {
      const data = new TextDecoder().decode(event.query.data);
      const result = this.match.exec(data);
      if (result) {
        event.patternMatch = result;
      } else {
        return;
      }
    }

    if (this.func) {
      return this.func(event);
    }

    return true;
  }
}

export interface AnswerCallbackQueryParams {
  message: string;
  cacheTime: number;
  url: string;
  alert: boolean;
}

export class CallbackQueryEvent extends EventCommonSender {
  query: Api.UpdateBotCallbackQuery | Api.UpdateInlineBotCallbackQuery;
  patternMatch: RegExpMatchArray | undefined;
  private _message: CustomMessage | undefined;
  private _answered: boolean;

  constructor(
    query: Api.UpdateBotCallbackQuery | Api.UpdateInlineBotCallbackQuery,
    peer: Api.TypePeer,
    msgId: number,
  ) {
    super({
      msgId,
      chatPeer: peer,
      broadcast: false,
    });
    this.query = query;
    this.patternMatch = undefined;
    this._senderId = returnBigInt(query.userId);
    this._message = undefined;
    this._answered = false;
  }

  _setClient(client: AbstractTelegramClient) {
    super._setClient(client);
    const [sender, inputSender] = getEntityPair_(
      this._senderId!.toString(),
      this._entities,
      client._entityCache,
    );
    this._sender = sender;
    this._inputSender = inputSender;
  }

  get id() {
    return this.query.queryId;
  }

  get messageId() {
    return this._messageId!;
  }

  get data() {
    return this.query.data;
  }

  get chatInstance() {
    return this.query.chatInstance;
  }

  async getMessage() {
    if (this._message) {
      return this._message;
    }
    const chat = this.isChannel ? await this.getInputChat() : undefined;
    const messages = await this._client!.getMessages(chat, {
      ids: this._messageId,
    });
    this._message = new CustomMessage(messages[0]);

    return this._message;
  }

  async _refetchSender() {
    if (this._entities.has(this.senderId!.toString())) {
      this._sender = this._entities.get(this.senderId!.toString());
    }

    if (!this._sender) return;

    this._inputSender = getInputPeer(this._chat);
    // deno-lint-ignore no-prototype-builtins
    if (!this._inputSender.hasOwnProperty("accessHash")) {
      try {
        this._inputSender = this._client!._entityCache.get(
          this._senderId,
        );
      } catch (_e) {
        const m = await this.getMessage();
        if (m) {
          this._sender = m._sender;
          this._inputSender = m._inputSender;
        }
      }
    }
  }

  async answer({
    message,
    cacheTime,
    url,
    alert,
  }: Partial<AnswerCallbackQueryParams> = {}) {
    if (this._answered) return;

    return await this._client!.invoke(
      new Api.messages.SetBotCallbackAnswer({
        queryId: this.query.queryId,
        cacheTime,
        alert,
        message,
        url,
      }),
      // deno-lint-ignore no-explicit-any
    ).then((res: any) => {
      this._answered = true;
      return res;
    });
  }

  get viaInline() {
    return this.query instanceof Api.UpdateInlineBotCallbackQuery;
  }

  async respond(params: SendMessageParams = {}) {
    await this.answer();
    const inputChat = await this.getInputChat();
    await this._client!.sendMessage(inputChat!, params);
  }

  async reply(params: SendMessageParams = {}) {
    await this.answer();
    params.replyTo = this.messageId;
    const inputChat = await this.getInputChat();
    await this._client!.sendMessage(inputChat!, params);
  }

  async edit(params: EditMessageParams) {
    // deno-lint-ignore no-explicit-any
    if ((this.query.msgId as any) instanceof Api.InputBotInlineMessageID) {
      return await this._client!.editMessage(this.messageId, params).then(
        // deno-lint-ignore no-explicit-any
        async (res: any) => {
          await this.answer();
          return res;
        },
      );
    } else {
      const inputChat = await this.getInputChat();

      return await this._client!.editMessage(inputChat!, params).then(
        // deno-lint-ignore no-explicit-any
        async (res: any) => {
          await this.answer();
          return res;
        },
      );
    }
  }

  async delete({ revoke } = { revoke: false }) {
    if (this._client) {
      return this._client.deleteMessages(
        await this.getInputChat(),
        // deno-lint-ignore no-explicit-any
        [this.messageId as any],
        { revoke },
      );
    }
  }

  get sender() {
    return this._sender;
  }
}
