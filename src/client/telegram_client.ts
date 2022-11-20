import { TelegramBaseClient, TelegramClientParams } from "./base_client.ts";
import { Dialog, InlineResults } from "../tl/custom/mod.ts";
import * as twoFA from "./2fa.ts";
import * as authMethods from "./auth.ts";
import * as botMethods from "./bots.ts";
import * as buttonsMethods from "./buttons.ts";
import * as downloadMethods from "./downloads.ts";
import * as parseMethods from "./message_parse.ts";
import * as messageMethods from "./messages.ts";
import * as updateMethods from "./updates.ts";
import * as uploadMethods from "./uploads.ts";
import * as userMethods from "./users.ts";
import * as chatMethods from "./chats.ts";
import * as dialogMethods from "./dialogs.ts";
import { Api } from "../tl/api.js";
import { sanitizeParseMode } from "../utils.ts";
import type { EventBuilder } from "../events/common.ts";
import { MTProtoSender } from "../network/mtproto_sender.ts";
import { CustomMessage } from "../tl/custom/message.ts";
import { LAYER } from "../tl/all_tl_objects.ts";
import { _handleUpdate, _updateLoop } from "./updates.ts";
import { Session } from "../sessions/mod.ts";
import { Album, AlbumEvent } from "../events/album.ts";
import { NewMessage, NewMessageEvent } from "../events/new_message.ts";
import { CallbackQuery, CallbackQueryEvent } from "../events/callback_query.ts";
import { EditedMessage, EditedMessageEvent } from "../events/edited_message.ts";
import {
  DeletedMessage,
  DeletedMessageEvent,
} from "../events/deleted_message.ts";
import { LogLevel } from "../extensions/logger.ts";
import { AbstractTelegramClient } from "./abstract_telegram_client.ts";
import { TotalList } from "../helpers.ts";
import * as types from "./types.ts";
import { Buffer } from "../../deps.ts";

export class TelegramClient extends TelegramBaseClient
  implements AbstractTelegramClient {
  constructor(
    session: string | Session,
    apiId: number,
    apiHash: string,
    clientParams?: TelegramClientParams,
  ) {
    super(session, apiId, apiHash, clientParams);
  }

  start(
    authParams?: types.UserAuthParams | types.BotAuthParams,
  ): Promise<void> {
    return authMethods.start(this, authParams);
  }

  checkAuthorization(): Promise<boolean> {
    return authMethods.checkAuthorization(this);
  }

  signInUser(
    apiCredentials: types.ApiCredentials,
    authParams: types.UserAuthParams,
  ): Promise<Api.TypeUser> {
    return authMethods.signInUser(this, apiCredentials, authParams);
  }

  signInUserWithQrCode(
    apiCredentials: types.ApiCredentials,
    authParams: types.QrCodeAuthParams,
  ): Promise<Api.TypeUser> {
    return authMethods.signInUserWithQrCode(
      this,
      apiCredentials,
      authParams,
    );
  }

  sendCode(
    apiCredentials: types.ApiCredentials,
    phoneNumber: string,
    forceSMS = false,
  ): Promise<{
    phoneCodeHash: string;
    isCodeViaApp: boolean;
  }> {
    return authMethods.sendCode(
      this,
      apiCredentials,
      phoneNumber,
      forceSMS,
    );
  }

  signInWithPassword(
    apiCredentials: types.ApiCredentials,
    authParams: types.UserPasswordAuthParams,
  ): Promise<Api.TypeUser> {
    return authMethods.signInWithPassword(this, apiCredentials, authParams);
  }

  signInBot(
    apiCredentials: types.ApiCredentials,
    authParams: types.BotAuthParams,
  ): Promise<Api.TypeUser> {
    return authMethods.signInBot(this, apiCredentials, authParams);
  }

  updateTwoFaSettings({
    isCheckPassword,
    currentPassword,
    newPassword,
    hint = "",
    email,
    emailCodeCallback,
    onEmailCodeError,
  }: types.TwoFaParams): Promise<void> {
    return twoFA.updateTwoFaSettings(this, {
      isCheckPassword,
      currentPassword,
      newPassword,
      hint,
      email,
      emailCodeCallback,
      onEmailCodeError,
    });
  }

  inlineQuery(
    bot: Api.TypeEntityLike,
    query: string,
    entity?: Api.InputPeerSelf,
    offset?: string,
    geoPoint?: Api.TypeInputGeoPoint,
  ): Promise<InlineResults> {
    return botMethods.inlineQuery(
      this,
      bot,
      query,
      entity,
      offset,
      geoPoint,
    );
  }

  buildReplyMarkup(
    buttons:
      | Api.TypeReplyMarkup
      | undefined
      | Api.TypeButtonLike
      | Api.TypeButtonLike[]
      | Api.TypeButtonLike[][],
    inlineOnly = false,
  ) {
    return buttonsMethods.buildReplyMarkup(buttons, inlineOnly);
  }

  downloadFile(
    inputLocation: Api.TypeInputFileLocation,
    fileParams: types.DownloadFileParamsV2 = {},
  ): Promise<string | Buffer | undefined> {
    return downloadMethods.downloadFileV2(this, inputLocation, fileParams);
  }

  iterDownload(
    iterFileParams: types.IterDownloadFunction,
  ): downloadMethods.DirectDownloadIter {
    return downloadMethods.iterDownload(this, iterFileParams);
  }

  downloadProfilePhoto(
    entity: Api.TypeEntityLike,
    downloadProfilePhotoParams: types.DownloadProfilePhotoParams = {
      isBig: false,
    },
  ): Promise<string | Buffer | Buffer | undefined> {
    return downloadMethods.downloadProfilePhoto(
      this,
      entity,
      downloadProfilePhotoParams,
    );
  }

  downloadMedia(
    messageOrMedia: CustomMessage | Api.Message | Api.TypeMessageMedia,
    downloadParams?: types.DownloadMediaInterface,
  ): Promise<Buffer | string | undefined> | Buffer {
    return downloadMethods.downloadMedia(
      this,
      messageOrMedia,
      downloadParams?.outputFile,
      downloadParams?.thumb,
      downloadParams?.progressCallback,
    );
  }

  get parseMode() {
    return this._parseMode;
  }

  setParseMode(
    mode:
      | "md"
      | "markdown"
      | "html"
      | types.ParseInterface
      | undefined,
  ) {
    if (mode) {
      this._parseMode = sanitizeParseMode(mode);
    } else {
      this._parseMode = undefined;
    }
  }

  iterMessages(
    entity: Api.TypeEntityLike | undefined,
    iterParams: Partial<types.IterMessagesParams> = {},
  ): AsyncIterable<Api.Message> {
    return messageMethods.iterMessages(this, entity, iterParams);
  }

  getMessages(
    entity: Api.TypeEntityLike | undefined,
    getMessagesParams: Partial<types.IterMessagesParams> = {},
  ): Promise<TotalList<Api.Message>> {
    return messageMethods.getMessages(this, entity, getMessagesParams);
  }

  sendMessage(
    entity: Api.TypeEntityLike,
    sendMessageParams: types.SendMessageParams = {},
  ): Promise<Api.Message> {
    return messageMethods.sendMessage(this, entity, sendMessageParams);
  }

  forwardMessages(
    entity: Api.TypeEntityLike,
    forwardMessagesParams: types.ForwardMessagesParams,
  ): Promise<Api.Message[]> {
    return messageMethods.forwardMessages(
      this,
      entity,
      forwardMessagesParams,
    );
  }

  editMessage(
    entity: Api.TypeEntityLike,
    editMessageParams: types.EditMessageParams,
  ): Promise<Api.Message> {
    return messageMethods.editMessage(this, entity, editMessageParams);
  }

  deleteMessages(
    entity: Api.TypeEntityLike | undefined,
    messageIds: Api.TypeMessageIDLike[],
    { revoke = true },
  ): Promise<Api.messages.AffectedMessages[]> {
    return messageMethods.deleteMessages(this, entity, messageIds, {
      revoke: revoke,
    });
  }

  pinMessage(
    entity: Api.TypeEntityLike,
    message?: undefined,
    pinMessageParams?: types.UpdatePinMessageParams,
  ): Promise<Api.messages.AffectedHistory>;
  pinMessage(
    entity: Api.TypeEntityLike,
    message: Api.TypeMessageIDLike,
    pinMessageParams?: types.UpdatePinMessageParams,
  ): Promise<Api.Message>;
  pinMessage(
    entity: Api.TypeEntityLike,
    // deno-lint-ignore no-explicit-any
    message?: any,
    pinMessageParams?: types.UpdatePinMessageParams,
  ) {
    return messageMethods.pinMessage(
      this,
      entity,
      message,
      pinMessageParams,
    );
  }

  unpinMessage(
    entity: Api.TypeEntityLike,
    message?: undefined,
    pinMessageParams?: types.UpdatePinMessageParams,
  ): Promise<Api.messages.AffectedHistory>;
  unpinMessage(
    entity: Api.TypeEntityLike,
    message: Api.TypeMessageIDLike,
    pinMessageParams?: types.UpdatePinMessageParams,
  ): Promise<undefined>;
  unpinMessage(
    entity: Api.TypeEntityLike,
    // deno-lint-ignore no-explicit-any
    message?: any,
    unpinMessageParams?: types.UpdatePinMessageParams,
  ) {
    return messageMethods.unpinMessage(
      this,
      entity,
      message,
      unpinMessageParams,
    ) as Promise<Api.messages.AffectedHistory | undefined>;
  }

  markAsRead(
    entity: Api.TypeEntityLike,
    message?: Api.TypeMessageIDLike | Api.TypeMessageIDLike[],
    markAsReadParams?: types.MarkAsReadParams,
  ): Promise<boolean> {
    return messageMethods.markAsRead(
      this,
      entity,
      message,
      markAsReadParams,
    );
  }

  iterDialogs(
    iterDialogsParams: types.IterDialogsParams = {},
  ): AsyncIterable<Dialog> {
    return dialogMethods.iterDialogs(this, iterDialogsParams);
  }

  getDialogs(params: types.IterDialogsParams = {}): Promise<TotalList<Dialog>> {
    return dialogMethods.getDialogs(this, params);
  }

  iterParticipants(
    entity: Api.TypeEntityLike,
    params: types.IterParticipantsParams = {},
  ): AsyncIterable<Api.User> {
    return chatMethods.iterParticipants(this, entity, params);
  }

  getParticipants(
    entity: Api.TypeEntityLike,
    params: types.IterParticipantsParams = {},
  ): Promise<TotalList<Api.User>> {
    return chatMethods.getParticipants(this, entity, params);
  }

  // deno-lint-ignore no-explicit-any
  on(event: any) {
    return updateMethods.on(this, event);
  }

  addEventHandler(
    callback: { (event: NewMessageEvent): void },
    event: NewMessage,
  ): void;
  addEventHandler(
    callback: { (event: CallbackQueryEvent): void },
    event: CallbackQuery,
  ): void;
  addEventHandler(
    callback: { (event: AlbumEvent): void },
    event: Album,
  ): void;
  addEventHandler(
    callback: { (event: EditedMessageEvent): void },
    event: EditedMessage,
  ): void;
  addEventHandler(
    callback: { (event: DeletedMessageEvent): void },
    event: DeletedMessage,
  ): void;
  addEventHandler(
    // deno-lint-ignore no-explicit-any
    callback: { (event: any): void },
    event?: EventBuilder,
  ): void;
  // deno-lint-ignore no-explicit-any
  addEventHandler(callback: { (event: any): void }, event?: EventBuilder) {
    return updateMethods.addEventHandler(this, callback, event);
  }

  removeEventHandler(callback: CallableFunction, event: EventBuilder) {
    return updateMethods.removeEventHandler(this, callback, event);
  }

  listEventHandlers(): [EventBuilder, CallableFunction][] {
    return updateMethods.listEventHandlers(this);
  }

  uploadFile(
    fileParams: types.UploadFileParams,
  ): Promise<Api.InputFile | Api.InputFileBig> {
    return uploadMethods.uploadFile(this, fileParams);
  }

  sendFile(
    entity: Api.TypeEntityLike,
    sendFileParams: types.SendFileInterface,
  ): Promise<CustomMessage> {
    return uploadMethods.sendFile(this, entity, sendFileParams);
  }

  invoke<R extends Api.AnyRequest>(
    request: R,
    sender?: MTProtoSender,
  ): Promise<R["__response"]> {
    return userMethods.invoke(this, request, sender);
  }

  getMe(inputPeer = false): Promise<Api.InputPeerUser | Api.User> {
    return userMethods.getMe(this, inputPeer);
  }

  isBot(): Promise<boolean | undefined> {
    return userMethods.isBot(this);
  }

  isUserAuthorized(): Promise<boolean> {
    return userMethods.isUserAuthorized(this);
  }

  getEntity(entity: Api.TypeEntityLike): Promise<Api.TypeEntity>;
  getEntity(entity: Api.TypeEntityLike[]): Promise<Api.TypeEntity[]>;
  // deno-lint-ignore no-explicit-any
  getEntity(entity: any) {
    return userMethods.getEntity(this, entity);
  }

  getInputEntity(entity: Api.TypeEntityLike): Promise<Api.TypeInputPeer> {
    return userMethods.getInputEntity(this, entity);
  }

  getPeerId(peer: Api.TypeEntityLike, addMark = true): Promise<string> {
    return userMethods.getPeerId(this, peer, addMark);
  }

  /** @hidden */
  // deno-lint-ignore no-explicit-any
  _getInputDialog(peer: any): Promise<any> {
    return userMethods._getInputDialog(this, peer);
  }

  /** @hidden */
  // deno-lint-ignore no-explicit-any
  _getInputNotify(notify: any): Promise<any> {
    return userMethods._getInputNotify(this, notify);
  }

  async _handleReconnect() {
    try {
      await this.getMe();
    } catch (e) {
      this._log.error(`Error while trying to reconnect`);
      if (this._log.canSend(LogLevel.ERROR)) {
        console.error(e);
      }
    }
  }

  async connect() {
    await this._initSession();
    if (this._sender === undefined) {
      this._sender = new MTProtoSender(this.session.getAuthKey(), {
        logger: this._log,
        dcId: this.session.dcId || 4,
        retries: this._connectionRetries,
        delay: this._retryDelay,
        autoReconnect: this._autoReconnect,
        connectTimeout: this._timeout,
        authKeyCallback: this._authKeyCallback.bind(this),
        updateCallback: _handleUpdate.bind(this),
        isMainSender: true,
        client: this,
        securityChecks: this._securityChecks,
        autoReconnectCallback: this._handleReconnect.bind(this),
      });
    }

    const connection = new this._connection({
      ip: this.session.serverAddress,
      port: this.useWSS ? 443 : 80,
      dcId: this.session.dcId,
      loggers: this._log,
      proxy: this._proxy,
      socket: this.networkSocket,
      testServers: this.testServers,
    });

    if (!(await this._sender.connect(connection))) {
      return;
    }

    this.session.setAuthKey(this._sender.authKey);
    this.session.save();
    this._initRequest.query = new Api.help.GetConfig();
    this._log.info(`Using LAYER ${LAYER} for initial connect`);
    await this._sender.send(
      new Api.InvokeWithLayer({
        layer: LAYER,
        query: this._initRequest,
      }),
    );
    _updateLoop(this);
  }

  /** @hidden */
  async _switchDC(newDc: number) {
    this._log.info(`Reconnecting to new data center ${newDc}`);
    const DC = await this.getDC(newDc);
    this.session.setDC(newDc, DC.ipAddress, DC.port);
    // authKey's are associated with a server, which has now changed
    // so it's not valid anymore. Set to undefined to force recreating it.
    await this._sender!.authKey.setKey(undefined);
    this.session.setAuthKey(undefined);
    this.session.save();
    await this._disconnect();
    return await this.connect();
  }

  async getDC(
    dcId: number,
    downloadDC = false,
    web = false,
  ): Promise<{ id: number; ipAddress: string; port: number }> {
    this._log.debug(`Getting DC ${dcId}`);
    if (web) {
      switch (dcId) {
        case 1:
          return {
            id: 1,
            ipAddress: `pluto${downloadDC ? "-1" : ""}.web.telegram.org`,
            port: 443,
          };
        case 2:
          return {
            id: 2,
            ipAddress: `venus${downloadDC ? "-1" : ""}.web.telegram.org`,
            port: 443,
          };
        case 3:
          return {
            id: 3,
            ipAddress: `aurora${downloadDC ? "-1" : ""}.web.telegram.org`,
            port: 443,
          };
        case 4:
          return {
            id: 4,
            ipAddress: `vesta${downloadDC ? "-1" : ""}.web.telegram.org`,
            port: 443,
          };
        case 5:
          return {
            id: 5,
            ipAddress: `flora${downloadDC ? "-1" : ""}.web.telegram.org`,
            port: 443,
          };
        default:
          throw new Error(
            `Cannot find the DC with the ID of ${dcId}`,
          );
      }
    }
    if (!this._config) {
      this._config = await this.invoke(new Api.help.GetConfig());
    }
    for (const DC of this._config.dcOptions) {
      if (DC.id === dcId && !!DC.ipv6 === this._useIPV6) {
        return {
          id: DC.id,
          ipAddress: DC.ipAddress,
          port: 443,
        };
      }
    }
    throw new Error(`Cannot find the DC with the ID of ${dcId}`);
  }

  /** @hidden */
  _removeSender(dcId: number) {
    delete this._borrowedSenderPromises[dcId];
  }

  /** @hidden */
  _getResponseMessage(
    // deno-lint-ignore no-explicit-any
    req: any,
    // deno-lint-ignore no-explicit-any
    result: any,
    // deno-lint-ignore no-explicit-any
    inputChat: any,
  ):
    | CustomMessage
    | Api.TypeMessage
    | Map<number, CustomMessage>
    | (CustomMessage | undefined)[]
    | undefined {
    return parseMethods._getResponseMessage(this, req, result, inputChat);
  }
}
