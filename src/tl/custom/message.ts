// deno-lint-ignore-file no-explicit-any ban-types getter-return
import { SenderGetter } from "./sender_getter.ts";
import { Api } from "../api.js";
import { ChatGetter } from "./chat_getter.ts";
import * as utils from "../../utils.ts";
import { Forward } from "./forward.ts";
import { File } from "./file.ts";
import { returnBigInt } from "../../helpers.ts";
import { LogLevel } from "../../extensions/logger.ts";
import { MessageButton } from "./message_button.ts";
import {
  EditMessageParams,
  SendMessageParams,
  UpdatePinMessageParams,
} from "../../client/messages.ts";
import { DownloadMediaInterface } from "../../client/downloads.ts";
import { _selfId } from "../../client/users.ts";
import { BigInteger, Buffer } from "../../../deps.ts";
import type { Entity, EntityLike } from "../../define.d.ts";
import type { TelegramClient } from "../../client/telegram_client.ts";

interface MessageBaseInterface {
  id: any;
  peerId?: any;
  date?: any;
  out?: any;
  mentioned?: any;
  mediaUnread?: any;
  silent?: any;
  post?: any;
  fromId?: any;
  replyTo?: any;
  message?: any;
  fwdFrom?: any;
  viaBotId?: any;
  media?: any;
  replyMarkup?: any;
  entities?: any;
  views?: any;
  editDate?: any;
  postAuthor?: any;
  groupedId?: any;
  fromScheduled?: any;
  legacy?: any;
  editHide?: any;
  pinned?: any;
  restrictionReason?: any;
  forwards?: any;
  ttlPeriod?: number;
  replies?: any;
  action?: any;
  reactions?: any;
  noforwards?: any;
  _entities?: Map<string, Entity>;
}

export interface ButtonClickParam {
  i?: number | number[];
  j?: number;
  text?: string | Function;
  filter?: Function;
  data?: Buffer;
  sharePhone?: boolean | string | Api.InputMediaContact;
  shareGeo?: [number, number] | Api.InputMediaGeoPoint;
  password?: string;
}

export class CustomMessage extends SenderGetter {
  static CONSTRUCTOR_ID: number;
  static SUBCLASS_OF_ID: number;
  CONSTRUCTOR_ID!: number;
  SUBCLASS_OF_ID!: number;

  out?: boolean;
  mentioned?: boolean;
  mediaUnread?: boolean;
  silent?: boolean;
  post?: boolean;
  fromScheduled?: boolean;
  legacy?: boolean;
  editHide?: boolean;
  pinned?: boolean;
  id!: number;
  fromId?: Api.TypePeer;
  peerId!: Api.TypePeer;
  fwdFrom?: Api.TypeMessageFwdHeader;
  viaBotId?: BigInteger;
  replyTo?: Api.MessageReplyHeader;
  date!: number;
  message!: string;
  media?: Api.TypeMessageMedia;
  replyMarkup?: Api.TypeReplyMarkup;
  entities?: Api.TypeMessageEntity[];
  views?: number;
  forwards?: number;
  replies?: Api.TypeMessageReplies;
  editDate?: number;
  postAuthor?: string;
  groupedId?: BigInteger;
  restrictionReason?: Api.TypeRestrictionReason[];
  action!: Api.TypeMessageAction;

  ttlPeriod?: number;
  reactions?: Api.MessageReactions;
  noforwards?: boolean;
  /** @hidden */
  _actionEntities?: any;
  /** @hidden */
  declare _client?: TelegramClient;
  /** @hidden */
  _text?: string;
  /** @hidden */
  _file?: File;
  /** @hidden */
  _replyMessage?: Api.Message;
  /** @hidden */
  _buttons?: MessageButton[][];
  /** @hidden */
  _buttonsFlat?: MessageButton[];
  /** @hidden */
  _buttonsCount?: number;
  /** @hidden */
  _viaBot?: EntityLike;
  /** @hidden */
  _viaInputBot?: EntityLike;
  /** @hidden */
  declare _inputSender?: any;
  /** @hidden */
  _forward?: Forward;
  /** @hidden */
  declare _sender?: any;
  /** @hidden */
  _entities?: Map<string, Entity>;
  /** @hidden */

  /* @ts-ignore */
  getBytes(): Buffer;
  originalArgs: any;
  patternMatch?: RegExpMatchArray;

  init({
    id,
    peerId = undefined,
    date = undefined,
    out = undefined,
    mentioned = undefined,
    mediaUnread = undefined,
    silent = undefined,
    post = undefined,
    fromId = undefined,
    replyTo = undefined,
    message = undefined,
    fwdFrom = undefined,
    viaBotId = undefined,
    media = undefined,
    replyMarkup = undefined,
    entities = undefined,
    views = undefined,
    editDate = undefined,
    postAuthor = undefined,
    groupedId = undefined,
    fromScheduled = undefined,
    legacy = undefined,
    editHide = undefined,
    pinned = undefined,
    restrictionReason = undefined,
    forwards = undefined,
    replies = undefined,
    action = undefined,
    reactions = undefined,
    noforwards = undefined,
    ttlPeriod = undefined,
    _entities = new Map<string, Entity>(),
  }: MessageBaseInterface) {
    if (!id) throw new Error("id is a required attribute for Message");
    let senderId = undefined;
    if (fromId) {
      senderId = utils.getPeerId(fromId);
    } else if (peerId) {
      if (post || (!out && peerId instanceof Api.PeerUser)) {
        senderId = utils.getPeerId(peerId);
      }
    }
    // Common properties to all messages
    this._entities = _entities;
    this.out = out;
    this.mentioned = mentioned;
    this.mediaUnread = mediaUnread;
    this.silent = silent;
    this.post = post;
    this.post = post;
    this.fromScheduled = fromScheduled;
    this.legacy = legacy;
    this.editHide = editHide;
    this.ttlPeriod = ttlPeriod;
    this.id = id;
    this.fromId = fromId;
    this.peerId = peerId;
    this.fwdFrom = fwdFrom;
    this.viaBotId = viaBotId;
    this.replyTo = replyTo;
    this.date = date;
    this.message = message;
    this.media = media instanceof Api.MessageMediaEmpty ? media : undefined;
    this.replyMarkup = replyMarkup;
    this.entities = entities;
    this.views = views;
    this.forwards = forwards;
    this.replies = replies;
    this.editDate = editDate;
    this.pinned = pinned;
    this.postAuthor = postAuthor;
    this.groupedId = groupedId;
    this.restrictionReason = restrictionReason;
    this.action = action;
    this.noforwards = noforwards;
    this.reactions = reactions;

    this._client = undefined;
    this._text = undefined;
    this._file = undefined;
    this._replyMessage = undefined;
    this._buttons = undefined;
    this._buttonsFlat = undefined;
    this._buttonsCount = 0;
    this._viaBot = undefined;
    this._viaInputBot = undefined;
    this._actionEntities = undefined;

    // Note: these calls would reset the client
    ChatGetter.initChatClass(this, { chatPeer: peerId, broadcast: post });
    SenderGetter.initSenderClass(this, {
      senderId: senderId ? returnBigInt(senderId) : undefined,
    });

    this._forward = undefined;
  }

  constructor(args: MessageBaseInterface) {
    super();
    this.init(args);
  }

  _finishInit(
    client: TelegramClient,
    entities: Map<string, Entity>,
    inputChat?: EntityLike,
  ) {
    this._client = client;
    const cache = client._entityCache;
    if (this.senderId) {
      [this._sender, this._inputSender] = utils.getEntityPair_(
        this.senderId.toString(),
        entities,
        cache,
      );
    }
    if (this.chatId) {
      [this._chat, this._inputChat] = utils.getEntityPair_(
        this.chatId.toString(),
        entities,
        cache,
      );
    }

    if (inputChat) {
      // This has priority
      this._inputChat = inputChat;
    }

    if (this.viaBotId) {
      [this._viaBot, this._viaInputBot] = utils.getEntityPair_(
        this.viaBotId.toString(),
        entities,
        cache,
      );
    }

    if (this.fwdFrom) {
      this._forward = new Forward(this._client, this.fwdFrom, entities);
    }

    if (this.action) {
      if (
        this.action instanceof Api.MessageActionChatAddUser ||
        this.action instanceof Api.MessageActionChatCreate
      ) {
        this._actionEntities = this.action.users.map((i) =>
          entities.get(i.toString())
        );
      } else if (this.action instanceof Api.MessageActionChatDeleteUser) {
        this._actionEntities = [
          entities.get(this.action.userId.toString()),
        ];
      } else if (
        this.action instanceof Api.MessageActionChatJoinedByLink
      ) {
        this._actionEntities = [
          entities.get(
            utils.getPeerId(
              new Api.PeerChannel({
                channelId: this.action.inviterId,
              }),
            ),
          ),
        ];
      } else if (
        this.action instanceof Api.MessageActionChannelMigrateFrom
      ) {
        this._actionEntities = [
          entities.get(
            utils.getPeerId(
              new Api.PeerChat({ chatId: this.action.chatId }),
            ),
          ),
        ];
      }
    }
  }

  get client() {
    return this._client;
  }

  get text() {
    if (this._text === undefined && this._client) {
      if (!this._client.parseMode) {
        this._text = this.message;
      } else {
        this._text = this._client.parseMode.unparse(
          this.message || "",
          this.entities || [],
        );
      }
    }
    return this._text || "";
  }

  set text(value: string) {
    this._text = value;
    if (this._client && this._client.parseMode) {
      [this.message, this.entities] = this._client.parseMode.parse(value);
    } else {
      this.message = value;
      this.entities = [];
    }
  }

  get rawText() {
    return this.message || "";
  }

  set rawText(value: string) {
    this.message = value;
    this.entities = [];
    this._text = "";
  }

  get isReply(): boolean {
    return !!this.replyTo;
  }

  get forward() {
    return this._forward;
  }

  async _refetchSender() {
    await this._reloadMessage();
  }

  async _reloadMessage() {
    if (!this._client) return;
    let msg: CustomMessage | undefined = undefined;
    try {
      const chat = this.isChannel ? await this.getInputChat() : undefined;
      const temp = await this._client.getMessages(chat, { ids: this.id });
      if (temp) {
        msg = temp[0] as CustomMessage;
      }
    } catch (e) {
      this._client._log.error(
        "Got error while trying to finish init message with id " +
          this.id,
      );
      if (this._client._log.canSend(LogLevel.ERROR)) {
        console.error(e);
      }
    }
    if (msg == undefined) return;

    this._sender = msg._sender;
    this._inputSender = msg._inputSender;
    this._chat = msg._chat;
    this._inputChat = msg._inputChat;
    this._viaBot = msg._viaBot;
    this._viaInputBot = msg._viaInputBot;
    this._forward = msg._forward;
    this._actionEntities = msg._actionEntities;
  }

  get buttons() {
    if (!this._buttons && this.replyMarkup) {
      if (!this.inputChat) {
        return;
      }
      try {
        const bot = this._neededMarkupBot();
        this._setButtons(this.inputChat, bot);
      } catch (_e) {
        return;
      }
    }
    return this._buttons;
  }

  async getButtons() {
    if (!this.buttons && this.replyMarkup) {
      const chat = await this.getInputChat();
      if (!chat) return;
      let bot;
      try {
        bot = this._neededMarkupBot();
      } catch (_e) {
        await this._reloadMessage();
        bot = this._neededMarkupBot();
      }
      this._setButtons(chat, bot);
    }
    return this._buttons;
  }

  get buttonCount() {
    if (!this._buttonsCount) {
      if (
        this.replyMarkup instanceof Api.ReplyInlineMarkup ||
        this.replyMarkup instanceof Api.ReplyKeyboardMarkup
      ) {
        this._buttonsCount = this.replyMarkup.rows
          .map((r) => r.buttons.length)
          .reduce(function (a, b) {
            return a + b;
          }, 0);
      } else {
        this._buttonsCount = 0;
      }
    }
    return this._buttonsCount;
  }

  get file() {
    if (!this._file) {
      const media = this.photo || this.document;
      if (media) {
        this._file = new File(media);
      }
    }
    return this._file;
  }

  get photo() {
    if (this.media instanceof Api.MessageMediaPhoto) {
      if (this.media.photo instanceof Api.Photo) return this.media.photo;
    } else if (this.action instanceof Api.MessageActionChatEditPhoto) {
      return this.action.photo;
    } else {
      return this.webPreview && this.webPreview.photo instanceof Api.Photo
        ? this.webPreview.photo
        : undefined;
    }
    return undefined;
  }

  get document() {
    if (this.media instanceof Api.MessageMediaDocument) {
      if (this.media.document instanceof Api.Document) {
        return this.media.document;
      }
    } else {
      const web = this.webPreview;

      return web && web.document instanceof Api.Document
        ? web.document
        : undefined;
    }
    return undefined;
  }

  get webPreview() {
    if (this.media instanceof Api.MessageMediaWebPage) {
      if (this.media.webpage instanceof Api.WebPage) {
        return this.media.webpage;
      }
    }
  }

  get audio() {
    return this._documentByAttribute(
      Api.DocumentAttributeAudio,
      (attr: Api.DocumentAttributeAudio) => !attr.voice,
    );
  }

  get voice() {
    return this._documentByAttribute(
      Api.DocumentAttributeAudio,
      (attr: Api.DocumentAttributeAudio) => !!attr.voice,
    );
  }

  get video() {
    return this._documentByAttribute(Api.DocumentAttributeVideo);
  }

  get videoNote() {
    return this._documentByAttribute(
      Api.DocumentAttributeVideo,
      (attr: Api.DocumentAttributeVideo) => !!attr.roundMessage,
    );
  }

  get gif() {
    return this._documentByAttribute(Api.DocumentAttributeAnimated);
  }

  get sticker() {
    return this._documentByAttribute(Api.DocumentAttributeSticker);
  }

  get contact() {
    if (this.media instanceof Api.MessageMediaContact) {
      return this.media;
    }
  }

  get game() {
    if (this.media instanceof Api.MessageMediaGame) {
      return this.media.game;
    }
  }

  get geo() {
    if (
      this.media instanceof Api.MessageMediaGeo ||
      this.media instanceof Api.MessageMediaGeoLive ||
      this.media instanceof Api.MessageMediaVenue
    ) {
      return this.media.geo;
    }
  }

  get invoice() {
    if (this.media instanceof Api.MessageMediaInvoice) {
      return this.media;
    }
  }

  get poll() {
    if (this.media instanceof Api.MessageMediaPoll) {
      return this.media;
    }
  }

  get venue() {
    if (this.media instanceof Api.MessageMediaVenue) {
      return this.media;
    }
  }

  get dice() {
    if (this.media instanceof Api.MessageMediaDice) {
      return this.media;
    }
  }

  get actionEntities() {
    return this._actionEntities;
  }

  get viaBot() {
    return this._viaBot;
  }

  get viaInputBot() {
    return this._viaInputBot;
  }

  get replyToMsgId() {
    return this.replyTo?.replyToMsgId;
  }

  get toId() {
    if (this._client && !this.out && this.isPrivate) {
      return new Api.PeerUser({
        userId: _selfId(this._client)!,
      });
    }
    return this.peerId;
  }

  getEntitiesText(cls?: Function) {
    let ent = this.entities;
    if (!ent || ent.length == 0) return;

    if (cls) {
      ent = ent.filter((v: any) => v instanceof cls);
    }

    const texts = utils.getInnerText(this.message || "", ent);
    const zip = (rows: any[]) =>
      rows[0].map((_: any, c: string | number) => rows.map((row) => row[c]));

    return zip([ent, texts]);
  }

  async getReplyMessage(): Promise<Api.Message | undefined> {
    if (!this._replyMessage && this._client) {
      if (!this.replyTo) return undefined;

      // Bots cannot access other bots' messages by their ID.
      // However they can access them through replies...
      this._replyMessage = (
        await this._client.getMessages(
          this.isChannel ? await this.getInputChat() : undefined,
          {
            ids: new Api.InputMessageReplyTo({ id: this.id }),
          },
        )
      )[0];

      if (!this._replyMessage) {
        // ...unless the current message got deleted.
        //
        // If that's the case, give it a second chance accessing
        // directly by its ID.
        this._replyMessage = (
          await this._client.getMessages(
            this.isChannel ? this._inputChat : undefined,
            {
              ids: this.replyToMsgId,
            },
          )
        )[0];
      }
    }
    return this._replyMessage;
  }

  async respond(params: SendMessageParams) {
    if (this._client) {
      return this._client.sendMessage(
        (await this.getInputChat())!,
        params,
      );
    }
  }

  async reply(params: SendMessageParams) {
    if (this._client) {
      params.replyTo = this.id;
      return this._client.sendMessage(
        (await this.getInputChat())!,
        params,
      );
    }
  }

  async forwardTo(entity: EntityLike) {
    if (this._client) {
      entity = await this._client.getInputEntity(entity);
      const params = {
        messages: [this.id],
        fromPeer: (await this.getInputChat())!,
      };
      return this._client.forwardMessages(entity, params);
    }
  }

  async edit(params: Omit<EditMessageParams, "message">) {
    const param = params as EditMessageParams;
    if (this.fwdFrom || !this.out || !this._client) return undefined;
    if (param.linkPreview == undefined) {
      param.linkPreview = !!this.webPreview;
    }
    if (param.buttons == undefined) {
      param.buttons = this.replyMarkup;
    }
    param.message = this.id;
    return this._client.editMessage((await this.getInputChat())!, param);
  }

  async delete({ revoke } = { revoke: false }) {
    if (this._client) {
      return this._client.deleteMessages(
        await this.getInputChat(),
        [this.id],
        {
          revoke,
        },
      );
    }
  }

  async pin(params?: UpdatePinMessageParams) {
    if (this._client) {
      const entity = await this.getInputChat();
      if (entity === undefined) {
        throw Error(
          "Failed to pin message due to cannot get input chat.",
        );
      }
      return this._client.pinMessage(entity, this.id, params);
    }
  }

  async unpin(params?: UpdatePinMessageParams) {
    if (this._client) {
      const entity = await this.getInputChat();
      if (entity === undefined) {
        throw Error(
          "Failed to unpin message due to cannot get input chat.",
        );
      }
      return this._client.unpinMessage(entity, this.id, params);
    }
  }

  downloadMedia(params?: DownloadMediaInterface) {
    // small hack for patched method
    if (this._client) {
      return this._client.downloadMedia(this as any, params || {});
    }
  }

  async markAsRead() {
    if (this._client) {
      const entity = await this.getInputChat();
      if (entity === undefined) {
        throw Error(
          `Failed to mark message id ${this.id} as read due to cannot get input chat.`,
        );
      }
      return this._client.markAsRead(entity, this.id);
    }
  }

  async click({
    i,
    j,
    text,
    filter,
    data,
    sharePhone,
    shareGeo,
    password,
  }: ButtonClickParam) {
    if (!this.client) {
      return;
    }
    if (data) {
      const chat = await this.getInputChat();
      if (!chat) {
        return;
      }

      const button = new Api.KeyboardButtonCallback({
        text: "",
        data: data,
      });
      return await new MessageButton(
        this.client,
        button,
        chat,
        undefined,
        this.id,
      ).click({
        sharePhone: sharePhone,
        shareGeo: shareGeo,
        password: password,
      });
    }
    if (this.poll) {
      // deno-lint-ignore no-inner-declarations
      function findPoll(answers: Api.PollAnswer[]) {
        if (i != undefined) {
          if (Array.isArray(i)) {
            const corrects = [];
            for (let x = 0; x < i.length; x++) {
              corrects.push(answers[x].option);
            }
            return corrects;
          }
          return [answers[i].option];
        }
        if (text != undefined) {
          if (typeof text == "function") {
            for (const answer of answers) {
              if (text(answer.text)) {
                return [answer.option];
              }
            }
          } else {
            for (const answer of answers) {
              if (answer.text == text) {
                return [answer.option];
              }
            }
          }
          return;
        }
        if (filter != undefined) {
          for (const answer of answers) {
            if (filter(answer)) {
              return [answer.option];
            }
          }
          return;
        }
      }

      const options = findPoll(this.poll.poll.answers) || [];
      return await this.client.invoke(
        new Api.messages.SendVote({
          peer: this.inputChat,
          msgId: this.id,
          options: options,
        }),
      );
    }

    if (!(await this.getButtons())) {
      return; // Accessing the property sets this._buttons[_flat]
    }

    function findButton(self: CustomMessage) {
      if (!self._buttonsFlat || !self._buttons) {
        return;
      }
      if (Array.isArray(i)) {
        i = i[0];
      }
      if (text != undefined) {
        if (typeof text == "function") {
          for (const button of self._buttonsFlat) {
            if (text(button.text)) {
              return button;
            }
          }
        } else {
          for (const button of self._buttonsFlat) {
            if (button.text == text) {
              return button;
            }
          }
        }
        return;
      }
      if (filter != undefined) {
        for (const button of self._buttonsFlat) {
          if (filter(button)) {
            return button;
          }
        }
        return;
      }
      if (i == undefined) {
        i = 0;
      }
      if (j == undefined) {
        return self._buttonsFlat[i];
      } else {
        return self._buttons[i][j];
      }
    }

    const button = findButton(this);
    if (button) {
      return await button.click({
        sharePhone: sharePhone,
        shareGeo: shareGeo,
        password: password,
      });
    }
  }

  _setButtons(chat: EntityLike, bot?: EntityLike) {
    if (
      this.client &&
      (this.replyMarkup instanceof Api.ReplyInlineMarkup ||
        this.replyMarkup instanceof Api.ReplyKeyboardMarkup)
    ) {
      this._buttons = [];
      this._buttonsFlat = [];
      for (const row of this.replyMarkup.rows) {
        const tmp = [];
        for (const button of row.buttons) {
          const btn = new MessageButton(
            this.client,
            button,
            chat,
            bot,
            this.id,
          );
          tmp.push(btn);
          this._buttonsFlat.push(btn);
        }
        this._buttons.push(tmp);
      }
    }
  }

  _neededMarkupBot() {
    if (!this.client || this.replyMarkup == undefined) {
      return;
    }
    if (
      !(
        this.replyMarkup instanceof Api.ReplyInlineMarkup ||
        this.replyMarkup instanceof Api.ReplyKeyboardMarkup
      )
    ) {
      return;
    }
    for (const row of this.replyMarkup.rows) {
      for (const button of row.buttons) {
        if (button instanceof Api.KeyboardButtonSwitchInline) {
          if (button.samePeer || !this.viaBotId) {
            const bot = this._inputSender;
            if (!bot) throw new Error("No input sender");
            return bot;
          } else {
            const ent = this.client!._entityCache.get(
              this.viaBotId,
            );
            if (!ent) throw new Error("No input sender");
            return ent;
          }
        }
      }
    }
  }

  _documentByAttribute(kind: Function, condition?: Function) {
    const doc = this.document;
    if (doc) {
      for (const attr of doc.attributes) {
        if (attr instanceof kind) {
          if (
            condition == undefined ||
            (typeof condition == "function" && condition(attr))
          ) {
            return doc;
          }
          return undefined;
        }
      }
    }
  }
}
