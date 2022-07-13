// deno-lint-ignore-file no-explicit-any
import { ProxyInterface } from "./tcpmt_proxy.ts";
import { AbridgedPacketCodec } from "./tcpa_bridged.ts";
import { FullPacketCodec } from "./tcp_full.ts";
import { AsyncQueue } from "../../extensions/async_queue.ts";
import { Logger } from "../../extensions/logger.ts";
import type { PromisedNetSockets } from "../../extensions/promised_net_sockets.ts";
import type { PromisedWebSockets } from "../../extensions/promised_web_sockets.ts";
import { Buffer } from "deps.ts";

export interface ConnectionInterfaceParams {
  ip: string;
  port: number;
  dcId: number;
  loggers: Logger;
  proxy?: ProxyInterface;
  socket: typeof PromisedNetSockets | typeof PromisedWebSockets;
  testServers: boolean;
}

export class Connection {
  PacketCodecClass?: typeof AbridgedPacketCodec | typeof FullPacketCodec;
  readonly _ip: string;
  readonly _port: number;
  _dcId: number;
  _log: Logger;
  _proxy?: ProxyInterface;
  private _connected: boolean;
  private _sendTask?: Promise<void>;
  private _recvTask?: Promise<void>;
  protected _codec: any;
  protected _obfuscation: any;
  private readonly _sendArray: AsyncQueue;
  private _recvArray: AsyncQueue;
  socket: PromisedNetSockets | PromisedWebSockets;
  public _testServers: boolean;

  constructor({
    ip,
    port,
    dcId,
    loggers,
    proxy,
    socket,
    testServers,
  }: ConnectionInterfaceParams) {
    this._ip = ip;
    this._port = port;
    this._dcId = dcId;
    this._log = loggers;
    this._proxy = proxy;
    this._connected = false;
    this._sendTask = undefined;
    this._recvTask = undefined;
    this._codec = undefined;
    this._obfuscation = undefined; // TcpObfuscated and MTProxy
    this._sendArray = new AsyncQueue();
    this._recvArray = new AsyncQueue();
    this.socket = new socket(proxy);
    this._testServers = testServers;
  }

  async _connect() {
    this._log.debug("Connecting");
    this._codec = new this.PacketCodecClass!(this);
    await this.socket.connect(this._port, this._ip, this._testServers);
    this._log.debug("Finished connecting");
    this._initConn();
  }

  async connect() {
    await this._connect();
    this._connected = true;

    this._sendTask = this._sendLoop();
    this._recvTask = this._recvLoop();
  }

  async disconnect() {
    this._connected = false;
    await this._recvArray.push(undefined);
    await this.socket.close();
  }

  async send(data: Buffer) {
    if (!this._connected) {
      await this._sendArray.push(undefined);
      throw new Error("Not connected");
    }
    await this._sendArray.push(data);
  }

  async recv() {
    while (this._connected) {
      const result = await this._recvArray.pop();
      if (result && result.length) {
        return result;
      }
    }
    throw new Error("Not connected");
  }

  async _sendLoop() {
    // TODO handle errors
    try {
      while (this._connected) {
        const data = await this._sendArray.pop();
        if (!data) {
          this._sendTask = undefined;
          return;
        }
        await this._send(data);
      }
    } catch (_e) {
      this._log.info("The server closed the connection while sending");
    }
  }

  async _recvLoop() {
    let data;
    while (this._connected) {
      try {
        data = await this._recv();
        if (!data) {
          throw new Error("no data received");
        }
      } catch (_e) {
        this._log.info("connection closed");
        //await this._recvArray.push()

        this.disconnect();
        return;
      }
      await this._recvArray.push(data);
    }
  }

  _initConn() {
    if (this._codec.tag) {
      this.socket.write(this._codec.tag);
    }
  }

  _send(data: Buffer) {
    const encodedPacket = this._codec.encodePacket(data);
    this.socket.write(encodedPacket);
  }

  async _recv() {
    return await this._codec.readPacket(this.socket);
  }

  toString() {
    return `${this._ip}:${this._port}/${
      this.constructor.name.replace("Connection", "")
    }`;
  }
}

export class ObfuscatedConnection extends Connection {
  ObfuscatedIO: any = undefined;

  async _initConn() {
    this._obfuscation = new this.ObfuscatedIO(this);
    await this._obfuscation.initHeader();
    this.socket.write(this._obfuscation.header);
  }

  _send(data: Buffer) {
    this._obfuscation.write(this._codec.encodePacket(data));
  }

  async _recv() {
    return await this._codec.readPacket(this._obfuscation);
  }
}

export class PacketCodec {
  private _conn: Buffer;

  constructor(connection: Buffer) {
    this._conn = connection;
  }

  encodePacket(_data: Buffer) {
    throw new Error("Not Implemented");
  }

  readPacket(
    _reader: PromisedNetSockets | PromisedWebSockets,
  ): Promise<Buffer> {
    throw new Error("Not Implemented");
  }
}
