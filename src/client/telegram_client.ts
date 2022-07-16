import { TelegramBaseClient, TelegramClientParams } from "./base_client.ts";
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
import type {
  ButtonLike,
  Entity,
  EntityLike,
  MessageIDLike,
} from "../define.d.ts";
import { Api } from "../tl/api.js";
import { sanitizeParseMode } from "../utils.ts";
import type { EventBuilder } from "../events/common.ts";
import { MTProtoSender } from "../network/mtproto_sender.ts";
import { LAYER } from "../tl/all_tl_objects.ts";
import { DownloadMediaInterface } from "./downloads.ts";
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

export class TelegramClient extends TelegramBaseClient {
  constructor(
    session: string | Session,
    apiId: number,
    apiHash: string,
    clientParams: TelegramClientParams,
  ) {
    super(session, apiId, apiHash, clientParams);
  }

  start(authParams?: authMethods.UserAuthParams | authMethods.BotAuthParams) {
    return authMethods.start(this, authParams);
  }

  checkAuthorization() {
    return authMethods.checkAuthorization(this);
  }

  signInUser(
    apiCredentials: authMethods.ApiCredentials,
    authParams: authMethods.UserAuthParams,
  ) {
    return authMethods.signInUser(this, apiCredentials, authParams);
  }

  signInUserWithQrCode(
    apiCredentials: authMethods.ApiCredentials,
    authParams: authMethods.QrCodeAuthParams,
  ) {
    return authMethods.signInUserWithQrCode(
      this,
      apiCredentials,
      authParams,
    );
  }

  sendCode(
    apiCredentials: authMethods.ApiCredentials,
    phoneNumber: string,
    forceSMS = false,
  ) {
    return authMethods.sendCode(
      this,
      apiCredentials,
      phoneNumber,
      forceSMS,
    );
  }

  signInWithPassword(
    apiCredentials: authMethods.ApiCredentials,
    authParams: authMethods.UserPasswordAuthParams,
  ) {
    return authMethods.signInWithPassword(this, apiCredentials, authParams);
  }

  signInBot(
    apiCredentials: authMethods.ApiCredentials,
    authParams: authMethods.BotAuthParams,
  ) {
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
  }: twoFA.TwoFaParams) {
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
    bot: EntityLike,
    query: string,
    entity?: Api.InputPeerSelf,
    offset?: string,
    geoPoint?: Api.TypeInputGeoPoint,
  ) {
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
      | ButtonLike
      | ButtonLike[]
      | ButtonLike[][],
    inlineOnly = false,
  ) {
    return buttonsMethods.buildReplyMarkup(buttons, inlineOnly);
  }

  downloadFile(
    inputLocation: Api.TypeInputFileLocation,
    fileParams: downloadMethods.DownloadFileParamsV2 = {},
  ) {
    return downloadMethods.downloadFileV2(this, inputLocation, fileParams);
  }

  downloadProfilePhoto(
    entity: EntityLike,
    downloadProfilePhotoParams: downloadMethods.DownloadProfilePhotoParams = {
      isBig: false,
    },
  ) {
    return downloadMethods.downloadProfilePhoto(
      this,
      entity,
      downloadProfilePhotoParams,
    );
  }

  downloadMedia(
    messageOrMedia: Api.Message | Api.TypeMessageMedia,
    downloadParams?: DownloadMediaInterface,
  ) {
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
      | parseMethods.ParseInterface
      | undefined,
  ) {
    if (mode) {
      this._parseMode = sanitizeParseMode(mode);
    } else {
      this._parseMode = undefined;
    }
  }

  iterMessages(
    entity: EntityLike | undefined,
    iterParams: Partial<messageMethods.IterMessagesParams> = {},
  ) {
    return messageMethods.iterMessages(this, entity, iterParams);
  }

  getMessages(
    entity: EntityLike | undefined,
    getMessagesParams: Partial<messageMethods.IterMessagesParams> = {},
  ) {
    return messageMethods.getMessages(this, entity, getMessagesParams);
  }

  sendMessage(
    entity: EntityLike,
    sendMessageParams: messageMethods.SendMessageParams = {},
  ) {
    return messageMethods.sendMessage(this, entity, sendMessageParams);
  }

  forwardMessages(
    entity: EntityLike,
    forwardMessagesParams: messageMethods.ForwardMessagesParams,
  ) {
    return messageMethods.forwardMessages(
      this,
      entity,
      forwardMessagesParams,
    );
  }

  editMessage(
    entity: EntityLike,
    editMessageParams: messageMethods.EditMessageParams,
  ) {
    return messageMethods.editMessage(this, entity, editMessageParams);
  }

  deleteMessages(
    entity: EntityLike | undefined,
    messageIds: MessageIDLike[],
    { revoke = true },
  ) {
    return messageMethods.deleteMessages(this, entity, messageIds, {
      revoke: revoke,
    });
  }

  pinMessage(
    entity: EntityLike,
    message?: undefined,
    pinMessageParams?: messageMethods.UpdatePinMessageParams,
  ): Promise<Api.messages.AffectedHistory>;
  pinMessage(
    entity: EntityLike,
    message: MessageIDLike,
    pinMessageParams?: messageMethods.UpdatePinMessageParams,
  ): Promise<Api.Message>;
  pinMessage(
    entity: EntityLike,
    // deno-lint-ignore no-explicit-any
    message?: any,
    pinMessageParams?: messageMethods.UpdatePinMessageParams,
  ) {
    return messageMethods.pinMessage(
      this,
      entity,
      message,
      pinMessageParams,
    );
  }

  unpinMessage(
    entity: EntityLike,
    message?: undefined,
    pinMessageParams?: messageMethods.UpdatePinMessageParams,
  ): Promise<Api.messages.AffectedHistory>;
  unpinMessage(
    entity: EntityLike,
    message: MessageIDLike,
    pinMessageParams?: messageMethods.UpdatePinMessageParams,
  ): Promise<undefined>;
  unpinMessage(
    entity: EntityLike,
    // deno-lint-ignore no-explicit-any
    message?: any,
    unpinMessageParams?: messageMethods.UpdatePinMessageParams,
  ) {
    return messageMethods.unpinMessage(
      this,
      entity,
      message,
      unpinMessageParams,
    ) as Promise<Api.messages.AffectedHistory | undefined>;
  }

  markAsRead(
    entity: EntityLike,
    message?: MessageIDLike | MessageIDLike[],
    markAsReadParams?: messageMethods.MarkAsReadParams,
  ) {
    return messageMethods.markAsRead(
      this,
      entity,
      message,
      markAsReadParams,
    );
  }

  iterDialogs(iterDialogsParams: dialogMethods.IterDialogsParams = {}) {
    return dialogMethods.iterDialogs(this, iterDialogsParams);
  }

  getDialogs(params: dialogMethods.IterDialogsParams = {}) {
    return dialogMethods.getDialogs(this, params);
  }

  iterParticipants(
    entity: EntityLike,
    params: chatMethods.IterParticipantsParams = {},
  ) {
    return chatMethods.iterParticipants(this, entity, params);
  }

  getParticipants(
    entity: EntityLike,
    params: chatMethods.IterParticipantsParams = {},
  ) {
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

  listEventHandlers() {
    return updateMethods.listEventHandlers(this);
  }

  uploadFile(fileParams: uploadMethods.UploadFileParams) {
    return uploadMethods.uploadFile(this, fileParams);
  }

  sendFile(
    entity: EntityLike,
    sendFileParams: uploadMethods.SendFileInterface,
  ) {
    return uploadMethods.sendFile(this, entity, sendFileParams);
  }

  invoke<R extends Api.AnyRequest>(
    request: R,
    sender?: MTProtoSender,
  ): Promise<R["__response"]> {
    return userMethods.invoke(this, request, sender);
  }

  getMe(inputPeer = false) {
    return userMethods.getMe(this, inputPeer);
  }

  isBot() {
    return userMethods.isBot(this);
  }

  isUserAuthorized() {
    return userMethods.isUserAuthorized(this);
  }

  getEntity(entity: EntityLike): Promise<Entity>;
  getEntity(entity: EntityLike[]): Promise<Entity[]>;
  // deno-lint-ignore no-explicit-any
  getEntity(entity: any) {
    return userMethods.getEntity(this, entity);
  }

  getInputEntity(entity: EntityLike) {
    return userMethods.getInputEntity(this, entity);
  }

  getPeerId(peer: EntityLike, addMark = true) {
    return userMethods.getPeerId(this, peer, addMark);
  }

  /** @hidden */
  // deno-lint-ignore no-explicit-any
  _getInputDialog(peer: any) {
    return userMethods._getInputDialog(this, peer);
  }

  /** @hidden */
  // deno-lint-ignore no-explicit-any
  _getInputNotify(notify: any) {
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
    // set defaults vars
    this._sender.userDisconnected = false;
    this._sender._userConnected = false;
    this._sender._reconnecting = false;
    this._sender._disconnected = true;

    const connection = new this._connection({
      ip: this.session.serverAddress,
      port: this.useWSS ? 443 : 80,
      dcId: this.session.dcId,
      loggers: this._log,
      proxy: this._proxy,
      socket: this.networkSocket,
      testServers: this.testServers,
    });
    const newConnection = await this._sender.connect(connection);
    if (!newConnection) {
      // we're already connected so no need to reset auth key.
      if (!this._loopStarted) {
        _updateLoop(this);
        this._loopStarted = true;
      }
      return;
    }

    this.session.setAuthKey(this._sender.authKey);
    this._initRequest.query = new Api.help.GetConfig();
    this._log.info(`Using LAYER ${LAYER} for initial connect`);
    await this._sender.send(
      new Api.InvokeWithLayer({
        layer: LAYER,
        query: this._initRequest,
      }),
    );

    if (!this._loopStarted) {
      _updateLoop(this);
      this._loopStarted = true;
    }
    this._reconnecting = false;
  }

  /** @hidden */
  async _switchDC(newDc: number) {
    this._log.info(`Reconnecting to new data center ${newDc}`);
    const DC = await this.getDC(newDc);
    this.session.setDC(newDc, DC.ipAddress, DC.port);
    // authKey's are associated with a server, which has now changed
    // so it's not valid anymore. Set to undefined to force recreating it.
    this._sender!.authKey.setKey(undefined);
    this.session.setAuthKey(undefined);
    this._reconnecting = true;
    await this.disconnect();
    return this.connect();
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
  // deno-lint-ignore no-explicit-any
  _getResponseMessage(req: any, result: any, inputChat: any) {
    return parseMethods._getResponseMessage(this, req, result, inputChat);
  }

  static get events() {
    return import("../events/mod.ts");
  }
}
