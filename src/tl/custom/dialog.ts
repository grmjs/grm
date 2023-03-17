import { Api } from "../api.js";
import { Draft } from "./draft.ts";
import { getDisplayName, getInputPeer, getPeerId } from "../../utils.ts";
import { returnBigInt } from "../../helpers.ts";
import { bigInt } from "../../deps.ts";
import { AbstractTelegramClient } from "../../client/abstract_telegram_client.ts";

export class Dialog {
  _client: AbstractTelegramClient;
  dialog: Api.Dialog;
  pinned: boolean;
  folderId?: number;
  archived: boolean;
  message?: Api.Message;
  date: number;
  entity?: Api.TypeEntity;
  inputEntity: Api.TypeInputPeer;
  id?: bigInt.BigInteger;
  name?: string;
  title?: string;
  unreadCount: number;
  unreadMentionsCount: number;
  draft: Draft;
  isUser: boolean;
  isGroup: boolean;
  isChannel: boolean;

  constructor(
    client: AbstractTelegramClient,
    dialog: Api.Dialog,
    entities: Map<string, Api.TypeEntity>,
    message?: Api.Message,
  ) {
    this._client = client;
    this.dialog = dialog;
    this.pinned = !!dialog.pinned;
    this.folderId = dialog.folderId;
    this.archived = dialog.folderId != undefined;
    this.message = message;
    this.date = this.message!.date!;

    this.entity = entities.get(getPeerId(dialog.peer));
    this.inputEntity = getInputPeer(this.entity);
    if (this.entity) {
      this.id = returnBigInt(getPeerId(this.entity)); // ^ May be InputPeerSelf();
      this.name = this.title = getDisplayName(this.entity);
    }

    this.unreadCount = dialog.unreadCount;
    this.unreadMentionsCount = dialog.unreadMentionsCount;
    if (!this.entity) {
      throw new Error("Entity not found for dialog");
    }
    this.draft = new Draft(client, this.entity, this.dialog.draft);

    this.isUser = this.entity instanceof Api.User;
    this.isGroup = !!(
      this.entity instanceof Api.Chat ||
      this.entity instanceof Api.ChatForbidden ||
      (this.entity instanceof Api.Channel && this.entity.megagroup)
    );
    this.isChannel = this.entity instanceof Api.Channel;
  }
}
