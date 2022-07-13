// deno-lint-ignore-file no-explicit-any
import { AuthKey } from "../crypto/authkey.ts";
import { MTProtoState } from "./mtproto_state.ts";
import { BinaryReader } from "../extensions/binary_reader.ts";
import type { PromisedNetSockets } from "../extensions/promised_net_sockets.ts";
import type { PromisedWebSockets } from "../extensions/promised_web_sockets.ts";
import { MessagePacker } from "../extensions/message_packer.ts";
import {
  GZIPPacked,
  MessageContainer,
  RPCResult,
  TLMessage,
} from "../tl/core/mod.ts";
import { Api } from "../tl/api.js";
import { sleep } from "../helpers.ts";
import { RequestState } from "./request_state.ts";
import { doAuthentication } from "./authenticator.ts";
import { MTProtoPlainSender } from "./mtproto_plain_sender.ts";
import {
  BadMessageError,
  InvalidBufferError,
  RPCMessageToError,
  SecurityError,
  TypeNotFoundError,
} from "../errors/mod.ts";
import { Connection } from "./connection/connection.ts";
import type { TelegramClient } from "../client/telegram_client.ts";
import { Logger, LogLevel } from "../extensions/logger.ts";
import { bigInt, BigInteger } from "deps.ts";

export class UpdateConnectionState {
  static disconnected = -1;
  static connected = 1;
  static broken = 0;
  state: number;
  constructor(state: number) {
    this.state = state;
  }
}

interface DEFAULT_OPTIONS {
  logger: any;
  retries: number;
  delay: number;
  autoReconnect: boolean;
  connectTimeout: any;
  authKeyCallback: any;
  updateCallback?: any;
  autoReconnectCallback?: any;
  isMainSender: boolean;
  dcId: number;
  senderCallback?: any;
  client: TelegramClient;
  onConnectionBreak?: CallableFunction;
  securityChecks: boolean;
}

export class MTProtoSender {
  static DEFAULT_OPTIONS = {
    logger: null,
    retries: Infinity,
    delay: 2000,
    autoReconnect: true,
    connectTimeout: null,
    authKeyCallback: null,
    updateCallback: null,
    autoReconnectCallback: null,
    isMainSender: null,
    senderCallback: null,
    onConnectionBreak: undefined,
    securityChecks: true,
  };
  _connection?: Connection;
  private readonly _log: Logger;
  private _dcId: number;
  private readonly _retries: number;
  private readonly _delay: number;
  private _connectTimeout: null;
  private _autoReconnect: boolean;
  private readonly _authKeyCallback: any;
  private readonly _updateCallback: (
    client: TelegramClient,
    update: UpdateConnectionState,
  ) => void;
  private readonly _autoReconnectCallback?: any;
  private readonly _senderCallback: any;
  private readonly _isMainSender: boolean;
  _userConnected: boolean;
  _reconnecting: boolean;
  _disconnected: boolean;
  private _sendLoopHandle: any;
  private _recvLoopHandle: any;
  readonly authKey: AuthKey;
  private readonly _state: MTProtoState;
  private _sendQueue: MessagePacker;
  private _pendingState: Map<string, RequestState>;
  private readonly _pendingAck: Set<any>;
  private readonly _lastAcks: any[];
  private readonly _handlers: any;
  private readonly _client: TelegramClient;
  private readonly _onConnectionBreak?: CallableFunction;
  userDisconnected: boolean;
  isConnecting: boolean;
  _authenticated: boolean;
  private _securityChecks: boolean;

  constructor(authKey: undefined | AuthKey, opts: DEFAULT_OPTIONS) {
    const args = {
      ...MTProtoSender.DEFAULT_OPTIONS,
      ...opts,
    };
    this._connection = undefined;
    this._log = args.logger;
    this._dcId = args.dcId;
    this._retries = args.retries;
    this._delay = args.delay;
    this._autoReconnect = args.autoReconnect;
    this._connectTimeout = args.connectTimeout;
    this._authKeyCallback = args.authKeyCallback;
    this._updateCallback = args.updateCallback;
    this._autoReconnectCallback = args.autoReconnectCallback;
    this._isMainSender = args.isMainSender;
    this._senderCallback = args.senderCallback;
    this._client = args.client;
    this._onConnectionBreak = args.onConnectionBreak;
    this._securityChecks = args.securityChecks;
    this.userDisconnected = false;
    this.isConnecting = false;
    this._authenticated = false;
    this._userConnected = false;
    this._reconnecting = false;
    this._disconnected = true;
    this._sendLoopHandle = null;
    this._recvLoopHandle = null;
    this.authKey = authKey || new AuthKey();
    this._state = new MTProtoState(
      this.authKey,
      this._log,
      this._securityChecks,
    );
    this._sendQueue = new MessagePacker(this._state, this._log);
    this._pendingState = new Map<string, any>();
    this._pendingAck = new Set();
    this._lastAcks = [];
    this._handlers = {
      [RPCResult.CONSTRUCTOR_ID.toString()]: this._handleRPCResult.bind(this),
      [MessageContainer.CONSTRUCTOR_ID.toString()]: this._handleContainer.bind(
        this,
      ),
      [GZIPPacked.CONSTRUCTOR_ID.toString()]: this._handleGzipPacked.bind(this),
      [Api.Pong.CONSTRUCTOR_ID.toString()]: this._handlePong.bind(this),
      [Api.BadServerSalt.CONSTRUCTOR_ID.toString()]: this._handleBadServerSalt
        .bind(this),
      [Api.BadMsgNotification.CONSTRUCTOR_ID.toString()]: this
        ._handleBadNotification.bind(this),
      [Api.MsgDetailedInfo.CONSTRUCTOR_ID.toString()]: this._handleDetailedInfo
        .bind(this),
      [Api.MsgNewDetailedInfo.CONSTRUCTOR_ID.toString()]: this
        ._handleNewDetailedInfo.bind(this),
      [Api.NewSessionCreated.CONSTRUCTOR_ID.toString()]: this
        ._handleNewSessionCreated.bind(this),
      [Api.MsgsAck.CONSTRUCTOR_ID.toString()]: this._handleAck.bind(this),
      [Api.FutureSalts.CONSTRUCTOR_ID.toString()]: this._handleFutureSalts.bind(
        this,
      ),
      [Api.MsgsStateReq.CONSTRUCTOR_ID.toString()]: this._handleStateForgotten
        .bind(this),
      [Api.MsgResendReq.CONSTRUCTOR_ID.toString()]: this._handleStateForgotten
        .bind(this),
      [Api.MsgsAllInfo.CONSTRUCTOR_ID.toString()]: this._handleMsgAll.bind(
        this,
      ),
    };
  }

  set dcId(dcId: number) {
    this._dcId = dcId;
  }

  get dcId() {
    return this._dcId;
  }

  async connect(connection: Connection, force?: boolean) {
    if (this._userConnected && !force) {
      this._log.info("User is already connected!");
      return false;
    }
    this.isConnecting = true;
    this._connection = connection;

    for (let attempt = 0; attempt < this._retries; attempt++) {
      try {
        await this._connect();
        if (this._updateCallback) {
          this._updateCallback(
            this._client,
            new UpdateConnectionState(
              UpdateConnectionState.connected,
            ),
          );
        }
        break;
      } catch (err) {
        if (this._updateCallback && attempt === 0) {
          this._updateCallback(
            this._client,
            new UpdateConnectionState(
              UpdateConnectionState.disconnected,
            ),
          );
        }
        this._log.error(
          `WebSocket connection failed attempt: ${attempt + 1}`,
        );
        if (this._log.canSend(LogLevel.ERROR)) {
          console.error(err);
        }
        await sleep(this._delay);
      }
    }
    this.userDisconnected = false;
    this.isConnecting = false;
    return true;
  }

  isConnected() {
    return this._userConnected;
  }

  async disconnect() {
    this.userDisconnected = true;
    await this._disconnect();
  }

  send(request: Api.AnyRequest): any {
    if (!this._userConnected) {
      throw new Error(
        "Cannot send requests while disconnected. You need to call .connect()",
      );
    }
    const state = new RequestState(request);
    this._sendQueue.append(state);
    return state.promise;
  }

  async _connect() {
    this._log.info(
      "Connecting to {0} using {1}"
        .replace("{0}", this._connection!.toString())
        .replace("{1}", this._connection!.socket.toString()),
    );
    await this._connection!.connect();
    this._log.debug("Connection success!");

    if (!this.authKey.getKey()) {
      const plain = new MTProtoPlainSender(this._connection, this._log);
      this._log.debug("New auth_key attempt ...");
      const res = await doAuthentication(plain, this._log);
      this._log.debug("Generated new auth_key successfully");
      this.authKey.setKey(res.authKey);
      this._state.timeOffset = res.timeOffset;
      if (this._authKeyCallback) {
        await this._authKeyCallback(this.authKey, this._dcId);
      }
    } else {
      this._authenticated = true;
      this._log.debug("Already have an auth key ...");
    }
    this._userConnected = true;
    this._reconnecting = false;
    this._log.debug("Starting receive loop");
    this._recvLoopHandle = this._recvLoop();

    this._log.debug("Starting send loop");
    this._sendLoopHandle = this._sendLoop();
    this._log.info(
      "Connection to %s complete!".replace(
        "%s",
        this._connection!.toString(),
      ),
    );
  }

  async _disconnect(_error = null) {
    this._sendQueue.rejectAll();

    if (this._connection === null) {
      this._log.info("Not disconnecting (already have no connection)");
      return;
    }
    if (this._updateCallback) {
      this._updateCallback(
        this._client,
        new UpdateConnectionState(UpdateConnectionState.disconnected),
      );
    }
    this._log.info(
      "Disconnecting from %s...".replace(
        "%s",
        this._connection!.toString(),
      ),
    );
    this._userConnected = false;
    this._log.debug("Closing current connection...");
    await this._connection!.disconnect();
  }

  async _sendLoop() {
    this._sendQueue = new MessagePacker(this._state, this._log);

    while (this._userConnected && !this._reconnecting) {
      if (this._pendingAck.size) {
        const ack = new RequestState(
          new Api.MsgsAck({ msgIds: Array(...this._pendingAck) }),
        );
        this._sendQueue.append(ack);
        this._lastAcks.push(ack);
        if (this._lastAcks.length >= 10) {
          this._lastAcks.shift();
        }
        this._pendingAck.clear();
      }
      this._log.debug(
        "Waiting for messages to send..." + this._reconnecting,
      );
      const res = await this._sendQueue.get();
      if (this._reconnecting) {
        this._log.debug("Reconnecting. will stop loop");
        return;
      }

      if (!res) {
        this._log.debug("Empty result. will not stop loop");
        continue;
      }
      let { data } = res;
      const { batch } = res;
      this._log.debug(
        `Encrypting ${batch.length} message(s) in ${data.length} bytes for sending`,
      );

      data = await this._state.encryptMessageData(data);

      try {
        await this._connection!.send(data);
      } catch (e: any) {
        this._log.error(e);
        this._log.info("Connection closed while sending data");
        return;
      }
      for (const state of batch) {
        if (!Array.isArray(state)) {
          if (state.request.classType === "request") {
            this._pendingState.set(state.msgId.toString(), state);
          }
        } else {
          for (const s of state) {
            if (s.request.classType === "request") {
              this._pendingState.set(s.msgId.toString(), s);
            }
          }
        }
      }
      this._log.debug("Encrypted messages put in a queue to be sent");
    }
  }

  async _recvLoop() {
    let body;
    let message;

    while (this._userConnected && !this._reconnecting) {
      this._log.debug("Receiving items from the network...");
      try {
        body = await this._connection!.recv();
      } catch (e: any) {
        if (!this.userDisconnected) {
          this._log.error(e);
          this._log.warn("Connection closed while receiving data");
          this.reconnect();
        }
        return;
      }
      try {
        message = await this._state.decryptMessageData(body);
      } catch (e: any) {
        if (e instanceof TypeNotFoundError) {
          this._log.info(
            `Type ${e.invalidConstructorId} not found, remaining data ${e.remaining}`,
          );
          continue;
        } else if (e instanceof SecurityError) {
          this._log.warn(
            `Security error while unpacking a received message: ${e}`,
          );
          continue;
        } else if (e instanceof InvalidBufferError) {
          // 404 means that the server has "forgotten" our auth key and we need to create a new one.
          if (e.code === 404) {
            this._log.warn(
              `Broken authorization key for dc ${this._dcId}; resetting`,
            );
            if (this._updateCallback && this._isMainSender) {
              this._updateCallback(
                this._client,
                new UpdateConnectionState(
                  UpdateConnectionState.broken,
                ),
              );
            } else if (
              this._onConnectionBreak &&
              !this._isMainSender
            ) {
              // Deletes the current sender from the object
              this._onConnectionBreak(this._dcId);
            }
          } else {
            // this happens sometimes when telegram is having some internal issues.
            // reconnecting should be enough usually
            // since the data we sent and received is probably wrong now.
            this._log.warn(
              `Invalid buffer ${e.code} for dc ${this._dcId}`,
            );
            this.reconnect();
          }
          return;
        } else {
          this._log.error("Unhandled error while receiving data");
          this._log.error(e);
          this.reconnect();
          return;
        }
      }
      try {
        await this._processMessage(message);
      } catch (e: any) {
        this._log.error("Unhandled error while receiving data");
        this._log.error(e);
      }
    }
  }

  async _processMessage(message: TLMessage) {
    this._pendingAck.add(message.msgId);

    message.obj = await message.obj;
    let handler = this._handlers[message.obj.CONSTRUCTOR_ID.toString()];
    if (!handler) {
      handler = this._handleUpdate.bind(this);
    }

    await handler(message);
  }

  _popStates(msgId: BigInteger) {
    const state = this._pendingState.get(msgId.toString());
    if (state) {
      this._pendingState.delete(msgId.toString());
      return [state];
    }

    const toPop = [];

    for (const state of this._pendingState.values()) {
      if (state.containerId && state.containerId.equals(msgId)) {
        toPop.push(state.msgId);
      }
    }

    if (toPop.length) {
      const temp = [];
      for (const x of toPop) {
        temp.push(this._pendingState.get(x!.toString()));
        this._pendingState.delete(x!.toString());
      }
      return temp;
    }

    for (const ack of this._lastAcks) {
      if (ack.msgId === msgId) {
        return [ack];
      }
    }

    return [];
  }

  _handleRPCResult(message: TLMessage) {
    const RPCResult = message.obj;
    const state = this._pendingState.get(RPCResult.reqMsgId.toString());
    if (state) {
      this._pendingState.delete(RPCResult.reqMsgId.toString());
    }
    this._log.debug(
      `Handling RPC result for message ${RPCResult.reqMsgId}`,
    );

    if (!state) {
      try {
        const reader = new BinaryReader(RPCResult.body);
        if (!(reader.tgReadObject() instanceof Api.upload.File)) {
          throw new Error("Not an upload.File");
        }
      } catch (e: any) {
        this._log.error(e);
        if (e instanceof TypeNotFoundError) {
          this._log.info(
            `Received response without parent request: ${RPCResult.body}`,
          );
          return;
        } else {
          throw e;
        }
      }
      return;
    }
    if (RPCResult.error && state.msgId) {
      const error = RPCMessageToError(RPCResult.error, state.request);
      this._sendQueue.append(
        new RequestState(new Api.MsgsAck({ msgIds: [state.msgId] })),
      );
      state.reject(error);
    } else {
      const reader = new BinaryReader(RPCResult.body);
      const read = state.request.readResult(reader);
      state.resolve(read);
    }
  }

  async _handleContainer(message: TLMessage) {
    this._log.debug("Handling container");
    for (const innerMessage of message.obj.messages) {
      await this._processMessage(innerMessage);
    }
  }

  async _handleGzipPacked(message: TLMessage) {
    this._log.debug("Handling gzipped data");
    const reader = new BinaryReader(message.obj.data);
    message.obj = reader.tgReadObject();
    await this._processMessage(message);
  }

  _handleUpdate(message: TLMessage) {
    if (message.obj.SUBCLASS_OF_ID !== 0x8af52aac) {
      // crc32(b'Updates')
      this._log.warn(
        `Note: ${message.obj.className} is not an update, not dispatching it`,
      );
      return;
    }
    this._log.debug("Handling update " + message.obj.className);
    if (this._updateCallback) {
      this._updateCallback(this._client, message.obj);
    }
  }

  _handlePong(message: TLMessage) {
    const pong = message.obj;
    this._log.debug(`Handling pong for message ${pong.msgId}`);
    const state = this._pendingState.get(pong.msgId.toString());
    this._pendingState.delete(pong.msgId.toString());

    // Todo Check result
    if (state) {
      state.resolve(pong);
    }
  }

  _handleBadServerSalt(message: TLMessage) {
    const badSalt = message.obj;
    this._log.debug(`Handling bad salt for message ${badSalt.badMsgId}`);
    this._state.salt = badSalt.newServerSalt;
    const states = this._popStates(badSalt.badMsgId);
    this._sendQueue.extend(states);
    this._log.debug(`${states.length} message(s) will be resent`);
  }

  _handleBadNotification(message: TLMessage) {
    const badMsg = message.obj;
    const states = this._popStates(badMsg.badMsgId);
    this._log.debug(`Handling bad msg ${JSON.stringify(badMsg)}`);
    if ([16, 17].includes(badMsg.errorCode)) {
      // Sent msg_id too low or too high (respectively).
      // Use the current msg_id to determine the right time offset.
      const to = this._state.updateTimeOffset(bigInt(message.msgId));
      this._log.info(`System clock is wrong, set time offset to ${to}s`);
    } else if (badMsg.errorCode === 32) {
      // msg_seqno too low, so just pump it up by some "large" amount
      // TODO A better fix would be to start with a new fresh session ID
      this._state._sequence += 64;
    } else if (badMsg.errorCode === 33) {
      // msg_seqno too high never seems to happen but just in case
      this._state._sequence -= 16;
    } else {
      for (const state of states) {
        state.reject(
          new BadMessageError(state.request, badMsg.errorCode),
        );
      }
      return;
    }
    // Messages are to be re-sent once we've corrected the issue
    this._sendQueue.extend(states);
    this._log.debug(
      `${states.length} messages will be resent due to bad msg`,
    );
  }

  _handleDetailedInfo(message: TLMessage) {
    // TODO https://goo.gl/VvpCC6
    const msgId = message.obj.answerMsgId;
    this._log.debug(`Handling detailed info for message ${msgId}`);
    this._pendingAck.add(msgId);
  }

  _handleNewDetailedInfo(message: TLMessage) {
    // TODO https://goo.gl/VvpCC6
    const msgId = message.obj.answerMsgId;
    this._log.debug(`Handling new detailed info for message ${msgId}`);
    this._pendingAck.add(msgId);
  }

  _handleNewSessionCreated(message: TLMessage) {
    // TODO https://goo.gl/LMyN7A
    this._log.debug("Handling new session created");
    this._state.salt = message.obj.serverSalt;
  }

  _handleAck(message: TLMessage) {
    const ack = message.obj;
    this._log.debug(`Handling acknowledge for ${ack.msgIds}`);
    for (const msgId of ack.msgIds) {
      const state = this._pendingState.get(msgId);
      if (state && state.request instanceof Api.auth.LogOut) {
        this._pendingState.delete(msgId);
        state.resolve(true);
      }
    }
  }

  _handleFutureSalts(message: TLMessage) {
    // TODO save these salts and automatically adjust to the
    // correct one whenever the salt in use expires.
    this._log.debug(`Handling future salts for message ${message.msgId}`);
    const state = this._pendingState.get(message.msgId.toString());

    if (state) {
      this._pendingState.delete(message.msgId.toString());
      state.resolve(message.obj);
    }
  }

  _handleStateForgotten(message: TLMessage) {
    this._sendQueue.append(
      new RequestState(
        new Api.MsgsStateInfo({
          reqMsgId: message.msgId,
          info: String.fromCharCode(1).repeat(message.obj.msgIds),
        }),
      ),
    );
  }

  async _handleMsgAll(_message: TLMessage) {}

  reconnect() {
    if (this._userConnected && !this._reconnecting) {
      this._reconnecting = true;
      sleep(1000).then(() => {
        this._log.info("Started reconnecting");
        this._reconnect();
      });
    }
  }

  async _reconnect() {
    this._log.debug("Closing current connection...");
    try {
      await this.disconnect();
    } catch (err: any) {
      this._log.warn(err);
    }
    // @ts-ignore no undefined
    this._sendQueue.append(undefined);
    this._state.reset();

    // For some reason reusing existing connection caused stuck requests
    const constructor = this._connection!
      .constructor as unknown as typeof Connection;
    const socket = this._connection!.socket.constructor as
      | typeof PromisedNetSockets
      | typeof PromisedWebSockets;
    const newConnection = new constructor({
      ip: this._connection!._ip,
      port: this._connection!._port,
      dcId: this._connection!._dcId,
      loggers: this._connection!._log,
      proxy: this._connection!._proxy,
      testServers: this._connection!._testServers,
      socket: socket,
    });

    await this.connect(newConnection, true);

    this._reconnecting = false;
    this._sendQueue.extend(Array.from(this._pendingState.values()));
    this._pendingState = new Map<string, RequestState>();
    if (this._autoReconnectCallback) {
      this._autoReconnectCallback();
    }
  }
}
