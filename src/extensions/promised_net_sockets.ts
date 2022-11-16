// deno-lint-ignore-file no-explicit-any
import { Buffer, Mutex, Socket, Socket_, SocksClient } from "../../deps.ts";
import { ProxyInterface } from "../network/connection/types.ts";

const mutex = new Mutex();
const closeError = new Error("NetSocket was closed");

export class PromisedNetSockets {
  private client?: Socket_;
  private closed: boolean;
  private stream: Buffer;
  private canRead?: boolean | Promise<boolean>;
  private resolveRead: ((value?: any) => void) | undefined;
  private proxy?: ProxyInterface;

  constructor(proxy?: ProxyInterface) {
    this.client = undefined;
    this.closed = true;
    this.stream = Buffer.alloc(0);

    if (!proxy?.MTProxy) {
      if (proxy) {
        if (!proxy.ip || !proxy.port || !proxy.socksType) {
          throw new Error(
            `Invalid sockets params. ${proxy.ip}, ${proxy.port}, ${proxy.socksType}`,
          );
        }
      }

      this.proxy = proxy;
    }
  }

  async readExactly(number: number) {
    let readData = Buffer.alloc(0);
    while (true) {
      const thisTime = await this.read(number);
      readData = Buffer.concat([readData, thisTime]);
      number = number - thisTime.length;
      if (!number) {
        return readData;
      }
    }
  }

  async read(number: number) {
    if (this.closed) {
      throw closeError;
    }
    await this.canRead;
    if (this.closed) {
      throw closeError;
    }
    const toReturn = this.stream.slice(0, number);
    this.stream = this.stream.slice(number);
    if (this.stream.length === 0) {
      this.canRead = new Promise((resolve) => {
        this.resolveRead = resolve;
      });
    }

    return toReturn;
  }

  async readAll() {
    if (this.closed || !(await this.canRead)) {
      throw closeError;
    }
    const toReturn = this.stream;
    this.stream = Buffer.alloc(0);
    this.canRead = new Promise((resolve) => {
      this.resolveRead = resolve;
    });
    return toReturn;
  }

  async connect(port: number, ip: string) {
    this.stream = Buffer.alloc(0);
    let connected = false;
    if (this.proxy) {
      const info = await SocksClient.createConnection({
        proxy: {
          host: this.proxy.ip,
          port: this.proxy.port,
          type: this.proxy.socksType != undefined ? this.proxy.socksType : 5, // Proxy version (4 or 5)
          userId: this.proxy.username,
          password: this.proxy.password,
        },

        command: "connect",
        timeout: (this.proxy.timeout || 5) * 1000,
        destination: {
          host: ip,
          port: port,
        },
      });
      // @ts-ignore heh
      this.client = info.socket;
      connected = true;
    } else {
      // @ts-ignore missing args
      this.client = new Socket();
    }

    this.canRead = new Promise((resolve) => {
      this.resolveRead = resolve;
    });
    this.closed = false;
    return new Promise((resolve, reject) => {
      if (this.client) {
        if (connected) {
          this.receive();
          resolve(this);
        } else {
          this.client.connect(port, ip, () => {
            this.receive();
            resolve(this);
          });
        }
        this.client.on("error", reject);
        this.client.on("close", () => {
          if (this.client && this.client.destroyed) {
            if (this.resolveRead) {
              this.resolveRead(false);
            }
            this.closed = true;
          }
        });
      }
    });
  }

  write(data: Buffer) {
    if (this.closed) {
      throw closeError;
    }
    if (this.client) {
      this.client.write(data);
    }
  }

  close() {
    if (this.client) {
      this.client.destroy();
      this.client.unref();
    }
    this.closed = true;
  }

  receive() {
    if (this.client) {
      this.client.on("data", async (message: Buffer) => {
        const release = await mutex.acquire();
        try {
          let _data;
          //CONTEST BROWSER
          this.stream = Buffer.concat([this.stream, message]);
          if (this.resolveRead) {
            this.resolveRead(true);
          }
        } finally {
          release();
        }
      });
    }
  }

  toString() {
    return "PromisedNetSocket";
  }
}
