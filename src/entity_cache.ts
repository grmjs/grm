// deno-lint-ignore-file no-explicit-any
import { Api } from "./tl/api.js";
import { getInputPeer, getPeerId } from "./utils.ts";
import { isArrayLike, returnBigInt } from "./helpers.ts";
import { bigInt } from "./deps.ts";

export function getEntityPair_(
  entityId: string,
  entities: Map<string, Api.TypeEntity>,
  cache: EntityCache,
  getInputPeerFunction: any = getInputPeer,
): [Api.TypeEntity?, Api.TypeInputPeer?] {
  const entity = entities.get(entityId);
  let inputEntity;
  try {
    inputEntity = cache.get(entityId);
  } catch (_e) {
    try {
      inputEntity = getInputPeerFunction(inputEntity);
    } catch (_e) {
      //
    }
  }
  return [entity, inputEntity];
}

export class EntityCache {
  private cacheMap: Map<string, any>;

  constructor() {
    this.cacheMap = new Map();
  }

  add(entities: any) {
    const temp = [];

    if (!isArrayLike(entities)) {
      if (entities !== undefined) {
        if (typeof entities === "object") {
          if ("chats" in entities) {
            temp.push(...entities.chats);
          }
          if ("users" in entities) {
            temp.push(...entities.users);
          }
          if ("user" in entities) {
            temp.push(entities.user);
          }
        }
      }

      if (temp.length) {
        entities = temp;
      } else {
        return;
      }
    }

    for (const entity of entities) {
      try {
        const pid = getPeerId(entity);
        if (!this.cacheMap.has(pid.toString())) {
          this.cacheMap.set(pid.toString(), getInputPeer(entity));
        }
      } catch (_e) {
        //
      }
    }
  }

  get(item: bigInt.BigInteger | string | undefined) {
    if (item === undefined) {
      throw new Error("No cached entity for the given key");
    }
    item = returnBigInt(item);
    if (item.lesser(bigInt.zero)) {
      let res;
      try {
        res = this.cacheMap.get(getPeerId(item).toString());
        if (res) return res;
      } catch (_e) {
        throw new Error("Invalid key will not have entity");
      }
    }
    for (const cls of [Api.PeerUser, Api.PeerChat, Api.PeerChannel]) {
      const result = this.cacheMap.get(
        getPeerId(
          new cls({
            userId: item,
            chatId: item,
            channelId: item,
          }),
        ).toString(),
      );
      if (result) return result;
    }
    throw new Error("No cached entity for the given key");
  }
}
