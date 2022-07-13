// deno-lint-ignore-file no-explicit-any
import { TelegramClient } from "./telegram_client.ts";
import { VERSION } from "../version.ts";
import { sleep } from "../helpers.ts";
import { Connection, ConnectionTCPFull } from "../network/mod.ts";
import { Session, StoreSession } from "../sessions/mod.ts";
import { Logger } from "../extensions/logger.ts";
import { PromisedNetSockets } from "../extensions/promised_net_sockets.ts";
import { PromisedWebSockets } from "../extensions/promised_web_sockets.ts";
import { Api } from "../tl/api.js";
import type { AuthKey } from "../crypto/authkey.ts";
import { EntityCache } from "../entity_cache.ts";
import type { ParseInterface } from "./message_parse.ts";
import type { EventBuilder } from "../events/common.ts";
import { MarkdownParser } from "../extensions/markdown.ts";
import { MTProtoSender } from "../network/mod.ts";
import { LAYER } from "../tl/all_tl_objects.ts";
import {
  ConnectionTCPMTProxyAbridged,
  ProxyInterface,
} from "../network/connection/tcpmt_proxy.ts";
import { LogLevel } from "../extensions/logger.ts";
import { Semaphore } from "../../deps.ts";

const EXPORTED_SENDER_RECONNECT_TIMEOUT = 1000; // 1 sec
const EXPORTED_SENDER_RELEASE_TIMEOUT = 30000; // 30 sec

const DEFAULT_DC_ID = 4;
const DEFAULT_IPV4_IP = "149.154.167.91"; // "vesta.web.telegram.org";
const DEFAULT_IPV6_IP = "2001:067c:04e8:f004:0000:0000:0000:000a";

export interface TelegramClientParams {
  connection?: typeof Connection;
  useIPV6?: boolean;
  timeout?: number;
  requestRetries?: number;
  connectionRetries?: number;
  proxy?: ProxyInterface;
  downloadRetries?: number;
  retryDelay?: number;
  autoReconnect?: boolean;
  sequentialUpdates?: boolean;
  floodSleepThreshold?: number;
  deviceModel?: string;
  systemVersion?: string;
  appVersion?: string;
  langCode?: string;
  systemLangCode?: string;
  baseLogger?: Logger;
  useWSS?: boolean;
  maxConcurrentDownloads?: number;
  securityChecks?: boolean;
  testServers?: boolean;
  networkSocket?: typeof PromisedNetSockets | typeof PromisedWebSockets;
}

const clientParamsDefault = {
  connection: ConnectionTCPFull, // ConnectionTCPObfuscated,
  networkSocket: PromisedNetSockets, // PromisedWebSockets,
  useIPV6: false,
  timeout: 10,
  requestRetries: 5,
  connectionRetries: Infinity,
  retryDelay: 1000,
  downloadRetries: 5,
  autoReconnect: true,
  sequentialUpdates: false,
  floodSleepThreshold: 60,
  deviceModel: "",
  systemVersion: "",
  appVersion: "",
  langCode: "en",
  systemLangCode: "en",
  _securityChecks: true,
  useWSS: false,
  testServers: false,
};

export abstract class TelegramBaseClient {
  __version__ = VERSION;
  _config?: Api.Config;
  public _log: Logger;
  public _floodSleepThreshold: number;
  public session: Session;
  public apiHash: string;
  public apiId: number;

  public _requestRetries: number;
  public _downloadRetries: number;
  public _connectionRetries: number;
  public _retryDelay: number;
  public _timeout: number;
  public _autoReconnect: boolean;
  public _connection: typeof Connection;
  public _initRequest: Api.InitConnection;
  public _sender?: MTProtoSender;
  public _floodWaitedRequests: any;
  public _borrowedSenderPromises: any;
  public _bot?: boolean;
  public _useIPV6: boolean;
  public _selfInputPeer?: Api.InputPeerUser;
  public useWSS: boolean;
  public _eventBuilders: [EventBuilder, CallableFunction][];
  public _entityCache: EntityCache;
  public _lastRequest?: number;
  public _parseMode?: ParseInterface;
  public _ALBUMS = new Map<
    string,
    [ReturnType<typeof setTimeout>, Api.TypeUpdate[]]
  >();
  private _exportedSenderPromises = new Map<number, Promise<MTProtoSender>>();
  private _exportedSenderReleaseTimeouts = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();
  protected _loopStarted: boolean;
  _reconnecting: boolean;
  _destroyed: boolean;
  protected _proxy?: ProxyInterface;
  _semaphore: Semaphore;
  _securityChecks: boolean;
  public testServers: boolean;
  public networkSocket: typeof PromisedNetSockets | typeof PromisedWebSockets;

  constructor(
    session: string | Session,
    apiId: number,
    apiHash: string,
    clientParams: TelegramClientParams,
  ) {
    clientParams = { ...clientParamsDefault, ...clientParams };
    if (!apiId || !apiHash) {
      throw new Error("Your API ID or Hash cannot be empty or undefined");
    }
    if (clientParams.baseLogger) {
      this._log = clientParams.baseLogger;
    } else {
      this._log = new Logger();
    }
    this._log.info("Running gramJS version " + VERSION);
    if (session && typeof session == "string") {
      session = new StoreSession(session);
    }
    if (!(session instanceof Session)) {
      throw new Error(
        "Only StringSession and StoreSessions are supported currently :( ",
      );
    }
    this._floodSleepThreshold = clientParams.floodSleepThreshold!;
    this.session = session;
    this.apiId = apiId;
    this.apiHash = apiHash;
    this._useIPV6 = clientParams.useIPV6!;
    this._requestRetries = clientParams.requestRetries!;
    this._downloadRetries = clientParams.downloadRetries!;
    this._connectionRetries = clientParams.connectionRetries!;
    this._retryDelay = clientParams.retryDelay || 0;
    this._timeout = clientParams.timeout!;
    this._autoReconnect = clientParams.autoReconnect!;
    this._proxy = clientParams.proxy;
    this._semaphore = new Semaphore(
      clientParams.maxConcurrentDownloads || 1,
    );
    this.testServers = clientParams.testServers || false;
    this.networkSocket = clientParams.networkSocket || PromisedNetSockets;
    if (!(clientParams.connection instanceof Function)) {
      throw new Error("Connection should be a class not an instance");
    }
    this._connection = clientParams.connection;
    let initProxy;
    if (this._proxy?.MTProxy) {
      this._connection = ConnectionTCPMTProxyAbridged;
      initProxy = new Api.InputClientProxy({
        address: this._proxy!.ip,
        port: this._proxy!.port,
      });
    }
    this._initRequest = new Api.InitConnection({
      apiId: this.apiId,
      deviceModel: clientParams.deviceModel || "Unknown",
      systemVersion: clientParams.systemVersion || "1.0",
      appVersion: clientParams.appVersion || "1.0",
      langCode: clientParams.langCode,
      langPack: "", // this should be left empty.
      systemLangCode: clientParams.systemLangCode,
      proxy: initProxy,
    });
    this._eventBuilders = [];

    this._floodWaitedRequests = {};
    this._borrowedSenderPromises = {};
    this._bot = undefined;
    this._selfInputPeer = undefined;
    this.useWSS = clientParams.useWSS!;
    this._securityChecks = !!clientParams.securityChecks;
    if (this.useWSS && this._proxy) {
      throw new Error(
        "Cannot use SSL with proxies. You need to disable the useWSS client param in TelegramClient",
      );
    }
    this._entityCache = new EntityCache();
    // These will be set later
    this._config = undefined;
    this._loopStarted = false;
    this._reconnecting = false;
    this._destroyed = false;

    // parse mode
    this._parseMode = MarkdownParser;
  }

  get floodSleepThreshold() {
    return this._floodSleepThreshold;
  }

  set floodSleepThreshold(value: number) {
    this._floodSleepThreshold = Math.min(value || 0, 24 * 60 * 60);
  }

  set maxConcurrentDownloads(value: number) {
    // @ts-ignore because node-gram has it?
    this._semaphore._value = value;
  }

  async _initSession() {
    await this.session.load();
    if (!this.session.serverAddress) {
      this.session.setDC(
        DEFAULT_DC_ID,
        this._useIPV6 ? DEFAULT_IPV6_IP : DEFAULT_IPV4_IP,
        this.useWSS ? 443 : 80,
      );
    } else {
      this._useIPV6 = this.session.serverAddress.includes(":");
    }
  }

  get connected() {
    return this._sender && this._sender.isConnected();
  }

  async disconnect() {
    if (this._sender) {
      await this._sender.disconnect();
    }
    await Promise.all(
      Object.values(this._exportedSenderPromises).map(
        (promise: Promise<MTProtoSender>) => {
          return (
            promise &&
            promise.then((sender: MTProtoSender) => {
              if (sender) {
                return sender.disconnect();
              }
              return undefined;
            })
          );
        },
      ),
    );

    this._exportedSenderPromises = new Map<
      number,
      Promise<MTProtoSender>
    >();
  }

  get disconnected() {
    return !this._sender || this._sender._disconnected;
  }

  async destroy() {
    this._destroyed = true;
    await Promise.all([
      this.disconnect(),
      ...Object.values(this._borrowedSenderPromises).map(
        (promise: any) => {
          return promise.then((sender: any) => sender.disconnect());
        },
      ),
    ]);

    this._eventBuilders = [];
  }

  _authKeyCallback(authKey: AuthKey, dcId: number) {
    this.session.setAuthKey(authKey, dcId);
    this.session.save();
  }

  async _cleanupExportedSender(dcId: number) {
    if (this.session.dcId !== dcId) {
      this.session.setAuthKey(undefined, dcId);
    }
    const sender = await this._exportedSenderPromises.get(dcId);
    this._exportedSenderPromises.delete(dcId);
    await sender?.disconnect();
  }

  async _connectSender(sender: MTProtoSender, dcId: number) {
    // if we don't already have an auth key we want to use normal DCs not -1
    const dc = await this.getDC(dcId, !!sender.authKey.getKey());

    while (true) {
      try {
        await sender.connect(
          new this._connection({
            ip: dc.ipAddress,
            port: dc.port,
            dcId: dcId,
            loggers: this._log,
            proxy: this._proxy,
            testServers: this.testServers,
            socket: this.networkSocket,
          }),
        );

        if (this.session.dcId !== dcId && !sender._authenticated) {
          this._log.info(
            `Exporting authorization for data center ${dc.ipAddress} with layer ${LAYER}`,
          );
          const auth = await this.invoke(
            new Api.auth.ExportAuthorization({ dcId: dcId }),
          );
          this._initRequest.query = new Api.auth.ImportAuthorization({
            id: auth.id,
            bytes: auth.bytes,
          });

          const req = new Api.InvokeWithLayer({
            layer: LAYER,
            query: this._initRequest,
          });
          await sender.send(req);
          sender._authenticated = true;
        }
        sender.dcId = dcId;
        sender.userDisconnected = false;

        return sender;
      } catch (err) {
        if (err.errorMessage === "DC_ID_INVALID") {
          sender._authenticated = true;
          sender.userDisconnected = false;
          return sender;
        }
        if (this._log.canSend(LogLevel.ERROR)) {
          console.error(err);
        }

        await sleep(1000);
        await sender.disconnect();
      }
    }
  }

  async _borrowExportedSender(
    dcId: number,
    shouldReconnect?: boolean,
    existingSender?: MTProtoSender,
  ): Promise<MTProtoSender> {
    if (!this._exportedSenderPromises.get(dcId) || shouldReconnect) {
      this._exportedSenderPromises.set(
        dcId,
        this._connectSender(
          existingSender || this._createExportedSender(dcId),
          dcId,
        ),
      );
    }

    let sender: MTProtoSender;
    try {
      sender = await this._exportedSenderPromises.get(dcId)!;

      if (!sender.isConnected()) {
        if (sender.isConnecting) {
          await sleep(EXPORTED_SENDER_RECONNECT_TIMEOUT);
          return this._borrowExportedSender(dcId, false, sender);
        } else {
          return this._borrowExportedSender(dcId, true, sender);
        }
      }
    } catch (err) {
      if (this._log.canSend(LogLevel.ERROR)) {
        console.error(err);
      }
      return this._borrowExportedSender(dcId, true);
    }

    if (this._exportedSenderReleaseTimeouts.get(dcId)) {
      clearTimeout(this._exportedSenderReleaseTimeouts.get(dcId)!);
      this._exportedSenderReleaseTimeouts.delete(dcId);
    }

    this._exportedSenderReleaseTimeouts.set(
      dcId,
      setTimeout(() => {
        this._exportedSenderReleaseTimeouts.delete(dcId);
        sender.disconnect();
      }, EXPORTED_SENDER_RELEASE_TIMEOUT),
    );

    return sender;
  }

  _createExportedSender(dcId: number) {
    return new MTProtoSender(this.session.getAuthKey(dcId), {
      logger: this._log,
      dcId,
      retries: this._connectionRetries,
      delay: this._retryDelay,
      autoReconnect: this._autoReconnect,
      connectTimeout: this._timeout,
      authKeyCallback: this._authKeyCallback.bind(this),
      isMainSender: dcId === this.session.dcId,
      onConnectionBreak: this._cleanupExportedSender.bind(this),
      client: this as unknown as TelegramClient,
      securityChecks: this._securityChecks,
    });
  }

  getSender(dcId: number): Promise<MTProtoSender> {
    return dcId
      ? this._borrowExportedSender(dcId)
      : Promise.resolve(this._sender!);
  }

  getDC(
    _dcId: number,
    _download: boolean,
  ): Promise<{ id: number; ipAddress: string; port: number }> {
    throw new Error("Cannot be called from here!");
  }

  invoke<R extends Api.AnyRequest>(_request: R): Promise<R["__response"]> {
    throw new Error("Cannot be called from here!");
  }

  setLogLevel(level: LogLevel) {
    this._log.setLevel(level);
  }

  get logger() {
    return this._log;
  }
}
