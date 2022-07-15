// deno-lint-ignore-file no-explicit-any
import { Api } from "../tl/api.js";
import { AuthKey } from "../crypto/authkey.ts";
import { Session } from "./abstract.ts";
import {
  getDisplayName,
  getInputPeer,
  getPeerId,
  parseID,
  parsePhone,
  parseUsername,
  resolveId,
} from "../utils.ts";
import { isArrayLike, returnBigInt } from "../helpers.ts";
import { bigInt } from "../../deps.ts";

export class MemorySession extends Session {
  protected _serverAddress?: string;
  protected _dcId: number;
  protected _port?: number;
  protected _takeoutId: undefined;
  protected _entities: Set<any>;
  protected _updateStates: Record<never, never>;
  protected _authKey?: AuthKey;

  constructor() {
    super();
    this._serverAddress = undefined;
    this._dcId = 0;
    this._port = undefined;
    this._takeoutId = undefined;
    this._entities = new Set();
    this._updateStates = {};
  }

  setDC(dcId: number, serverAddress: string, port: number) {
    this._dcId = dcId | 0;
    this._serverAddress = serverAddress;
    this._port = port;
  }

  get dcId() {
    return this._dcId;
  }

  get serverAddress() {
    return this._serverAddress!;
  }

  get port() {
    return this._port!;
  }

  get authKey() {
    return this._authKey;
  }

  set authKey(value) {
    this._authKey = value;
  }

  get takeoutId() {
    return this._takeoutId;
  }

  set takeoutId(value) {
    this._takeoutId = value;
  }

  getAuthKey(dcId?: number) {
    if (dcId && dcId !== this.dcId) {
      // Not supported.
      return undefined;
    }

    return this.authKey;
  }

  setAuthKey(authKey?: AuthKey, dcId?: number) {
    if (dcId && dcId !== this.dcId) {
      // Not supported.
      return undefined;
    }

    this.authKey = authKey;
  }

  close() {}

  save() {}

  async load() {}

  delete() {}

  _entityValuesToRow(
    id: bigInt.BigInteger | string,
    hash: bigInt.BigInteger | string,
    username: string,
    phone: string,
    name: string,
  ) {
    // While this is a simple implementation it might be overrode by,
    // other classes so they don't need to implement the plural form
    // of the method. Don't remove.
    return [id, hash, username, phone, name];
  }

  _entityToRow(e: any) {
    if (!(e.classType === "constructor")) {
      return;
    }
    let p;
    let markedId;
    try {
      p = getInputPeer(e, false);
      markedId = getPeerId(p);
    } catch (_e) {
      return;
    }
    let pHash;
    if (
      p instanceof Api.InputPeerUser ||
      p instanceof Api.InputPeerChannel
    ) {
      pHash = p.accessHash;
    } else if (p instanceof Api.InputPeerChat) {
      pHash = bigInt.zero;
    } else {
      return;
    }

    let username = e.username;
    if (username) {
      username = username.toLowerCase();
    }
    const phone = e.phone;
    const name = getDisplayName(e);
    return this._entityValuesToRow(markedId, pHash, username, phone, name);
  }

  _entitiesToRows(tlo: any) {
    let entities: any = [];
    if (!(tlo.classType === "constructor") && isArrayLike(tlo)) {
      // This may be a list of users already for instance
      entities = tlo;
    } else {
      if (typeof tlo === "object") {
        if ("user" in tlo) {
          entities.push(tlo.user);
        }
        if ("chat" in tlo) {
          entities.push(tlo.chat);
        }
        if ("channel" in tlo) {
          entities.push(tlo.channel);
        }
        if ("chats" in tlo && isArrayLike(tlo.chats)) {
          entities = entities.concat(tlo.chats);
        }
        if ("users" in tlo && isArrayLike(tlo.users)) {
          entities = entities.concat(tlo.users);
        }
      }
    }
    const rows = []; // Rows to add (id, hash, username, phone, name)
    for (const e of entities) {
      const row = this._entityToRow(e);
      if (row) {
        rows.push(row);
      }
    }
    return rows;
  }
  processEntities(tlo: any) {
    const entitiesSet = this._entitiesToRows(tlo);
    for (const e of entitiesSet) {
      this._entities.add(e);
    }
  }

  // deno-lint-ignore require-await
  async getEntityRowsByPhone(phone: string) {
    for (const e of this._entities) {
      // id, hash, username, phone, name
      if (e[3] === phone) {
        return [e[0], e[1]];
      }
    }
  }

  // deno-lint-ignore require-await
  async getEntityRowsByUsername(username: string) {
    for (const e of this._entities) {
      // id, hash, username, phone, name
      if (e[2] === username) {
        return [e[0], e[1]];
      }
    }
  }

  // deno-lint-ignore require-await
  async getEntityRowsByName(name: string) {
    for (const e of this._entities) {
      // id, hash, username, phone, name
      if (e[4] === name) {
        return [e[0], e[1]];
      }
    }
  }

  // deno-lint-ignore require-await
  async getEntityRowsById(id: string | bigInt.BigInteger, exact = true) {
    if (exact) {
      for (const e of this._entities) {
        // id, hash, username, phone, name
        if (e[0] === id) {
          return [e[0], e[1]];
        }
      }
    } else {
      const ids = [
        getPeerId(new Api.PeerUser({ userId: returnBigInt(id) })),
        getPeerId(new Api.PeerChat({ chatId: returnBigInt(id) })),
        getPeerId(
          new Api.PeerChannel({ channelId: returnBigInt(id) }),
        ),
      ];
      for (const e of this._entities) {
        // id, hash, username, phone, name
        if (ids.includes(e[0])) {
          return [e[0], e[1]];
        }
      }
    }
  }

  async getInputEntity(key: Api.TypeEntityLike): Promise<Api.TypeInputPeer> {
    let exact;
    if (
      typeof key === "object" &&
      !(bigInt.isInstance(key)) &&
      key.SUBCLASS_OF_ID
    ) {
      if (
        key.SUBCLASS_OF_ID === 0xc91c90b6 ||
        key.SUBCLASS_OF_ID === 0xe669bf46 ||
        key.SUBCLASS_OF_ID === 0x40f202fd
      ) {
        // @ts-ignore not assignable
        return key;
      }
      // Try to early return if this key can be casted as input peer
      return getInputPeer(key);
    } else {
      // Not a TLObject or can't be cast into InputPeer
      if (typeof key === "object") {
        key = getPeerId(key);
        exact = true;
      } else {
        exact = false;
      }
    }
    if (
      bigInt.isInstance(key as any) ||
      typeof key === "bigint" ||
      typeof key === "number"
    ) {
      key = key.toString();
    }
    let result = undefined;
    if (typeof key === "string") {
      const phone = parsePhone(key);
      if (phone) {
        result = await this.getEntityRowsByPhone(phone);
      } else {
        const { username, isInvite } = parseUsername(key);
        if (username && !isInvite) {
          result = await this.getEntityRowsByUsername(username);
        }
      }
      if (!result) {
        const id = parseID(key);
        if (id) {
          result = await this.getEntityRowsById(id, exact);
        }
      }
      if (!result) {
        result = await this.getEntityRowsByName(key);
      }
    }
    if (result) {
      let entityId = result[0]; // unpack resulting tuple
      const entityHash = bigInt(result[1]);
      const resolved = resolveId(returnBigInt(entityId));
      entityId = resolved[0];
      const kind = resolved[1];
      // removes the mark and returns type of entity
      if (kind === Api.PeerUser) {
        return new Api.InputPeerUser({
          userId: entityId,
          accessHash: entityHash,
        });
      } else if (kind === Api.PeerChat) {
        return new Api.InputPeerChat({ chatId: entityId });
      } else if (kind === Api.PeerChannel) {
        return new Api.InputPeerChannel({
          channelId: entityId,
          accessHash: entityHash,
        });
      }
    } else {
      throw new Error("Could not find input entity with key " + key);
    }
    throw new Error("Could not find input entity with key " + key);
  }
}
