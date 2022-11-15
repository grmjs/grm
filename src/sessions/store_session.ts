// deno-lint-ignore-file no-explicit-any
import { MemorySession } from "./memory_session.ts";
import { AuthKey } from "../crypto/authkey.ts";
import { bigInt, Buffer } from "../../deps.ts";

export class StoreSession extends MemorySession {
  private readonly sessionName: string;
  private store: Storage;

  constructor(sessionName: string, divider = ":") {
    super();
    this.store = localStorage;
    if (divider === undefined) divider = ":";
    this.sessionName = sessionName + divider;
  }

  async load() {
    const authKey_ = this.store.getItem(this.sessionName + "authKey");
    if (authKey_) {
      let authKey = JSON.parse(authKey_);
      if (authKey && typeof authKey === "object") {
        this._authKey = new AuthKey();
        if ("data" in authKey) {
          authKey = Buffer.from(authKey.data);
        }
        await this._authKey.setKey(authKey);
      }
    }

    const dcId = this.store.getItem(this.sessionName + "dcId");
    if (dcId) this._dcId = parseInt(dcId);

    const port = this.store.getItem(this.sessionName + "port");
    if (port) this._port = parseInt(port);

    const serverAddress = this.store.getItem(
      this.sessionName + "serverAddress",
    );
    if (serverAddress) this._serverAddress = serverAddress;
  }

  setDC(dcId: number, serverAddress: string, port: number) {
    this.store.setItem(this.sessionName + "dcId", dcId.toString());
    this.store.setItem(this.sessionName + "port", port.toString());
    this.store.setItem(this.sessionName + "serverAddress", serverAddress);
    super.setDC(dcId, serverAddress, port);
  }

  set authKey(value: AuthKey | undefined) {
    if (value) {
      this._authKey = value;
      this.store.setItem(
        this.sessionName + "authKey",
        JSON.stringify(value.getKey()),
      );
    }
  }

  get authKey() {
    return this._authKey;
  }

  processEntities(tlo: any) {
    const rows = this._entitiesToRows(tlo);
    if (!rows) return;
    for (const row of rows) {
      row.push(new Date().getTime().toString());
      this.store.setItem(this.sessionName + row[0], JSON.stringify(row));
    }
  }

  getEntityRowsById(
    id: string | bigInt.BigInteger,
    _exact = true,
  ): any {
    return JSON.parse(this.store.getItem(this.sessionName + id.toString())!);
  }
}
