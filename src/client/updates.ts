import type { EventBuilder } from "../events/common.ts";
import { Api } from "../tl/api.js";
import type { TelegramClient } from "./telegram_client.ts";
import { bigInt } from "deps.ts";
import { UpdateConnectionState } from "../network/mod.ts";
import type { Raw } from "../events/raw.ts";
import { getPeerId } from "../utils.ts";
import { getRandomInt, returnBigInt, sleep } from "../helpers.ts";

const PING_INTERVAL = 9000; // 9 sec
const PING_TIMEOUT = 10000; // 10 sec
const PING_FAIL_ATTEMPTS = 3;
const PING_FAIL_INTERVAL = 100; // ms
const PING_DISCONNECT_DELAY = 60000; // 1 min

export class StopPropagation extends Error {}
export function on(client: TelegramClient, event?: EventBuilder) {
  // deno-lint-ignore no-explicit-any
  return (f: { (event: any): void }) => {
    client.addEventHandler(f, event);
    return f;
  };
}

export function addEventHandler(
  client: TelegramClient,
  callback: CallableFunction,
  event?: EventBuilder,
) {
  if (event === undefined) {
    // recursive imports :(
    import("../events/raw.ts").then((r) => {
      event = new r.Raw({}) as Raw;
    });
  }
  event!.client = client;
  client._eventBuilders.push([event!, callback]);
}

export function removeEventHandler(
  client: TelegramClient,
  callback: CallableFunction,
  event: EventBuilder,
) {
  client._eventBuilders = client._eventBuilders.filter(function (item) {
    return item[0] !== event && item[1] !== callback;
  });
}

export function listEventHandlers(client: TelegramClient) {
  return client._eventBuilders;
}

export function catchUp() {
  // TODO
}

export function _handleUpdate(
  client: TelegramClient,
  update: Api.TypeUpdate | number,
): void {
  if (typeof update === "number") {
    if ([-1, 0, 1].includes(update)) {
      _dispatchUpdate(client, {
        update: new UpdateConnectionState(update),
      });
      return;
    }
  }

  // this.session.processEntities(update)
  client._entityCache.add(update);
  client.session.processEntities(update);

  if (
    update instanceof Api.Updates ||
    update instanceof Api.UpdatesCombined
  ) {
    // TODO deal with entities
    const entities = new Map();
    for (const x of [...update.users, ...update.chats]) {
      entities.set(getPeerId(x), x);
    }
    for (const u of update.updates) {
      _processUpdate(client, u, update.updates, entities);
    }
  } else if (update instanceof Api.UpdateShort) {
    _processUpdate(client, update.update, null);
  } else {
    _processUpdate(client, update, null);
  }
}

export function _processUpdate(
  client: TelegramClient,
  // deno-lint-ignore no-explicit-any
  update: any,
  // deno-lint-ignore no-explicit-any
  others: any,
  // deno-lint-ignore no-explicit-any
  entities?: any,
) {
  update._entities = entities || new Map();
  const args = {
    update: update,
    others: others,
  };

  _dispatchUpdate(client, args);
}

export async function _dispatchUpdate(
  client: TelegramClient,
  // deno-lint-ignore no-explicit-any
  args: { update: UpdateConnectionState | any },
): Promise<void> {
  for (const [builder, callback] of client._eventBuilders) {
    if (!builder || !callback) {
      continue;
    }
    if (!builder.resolved) {
      await builder.resolve(client);
    }
    let event = args.update;
    if (event) {
      if (!client._selfInputPeer) {
        try {
          await client.getMe(true);
        } catch (_e) {
          // do nothing
        }
      }
      if (!(event instanceof UpdateConnectionState)) {
        // TODO fix me
      }
      // TODO fix others not being passed
      event = builder.build(
        event,
        callback,
        client._selfInputPeer
          ? returnBigInt(client._selfInputPeer.userId)
          : undefined,
      );
      if (event) {
        event._client = client;

        if ("_eventName" in event) {
          event._setClient(client);
          event.originalUpdate = args.update;
          event._entities = args.update._entities;
        }
        const filter = builder.filter(event);
        if (!filter) {
          continue;
        }
        try {
          await callback(event);
        } catch (e) {
          if (e instanceof StopPropagation) {
            break;
          }
          console.error(e);
        }
      }
    }
  }
}

export async function _updateLoop(client: TelegramClient): Promise<void> {
  while (!client._destroyed) {
    await sleep(PING_INTERVAL);
    if (client._reconnecting || client._sender!.userDisconnected) {
      continue;
    }
    if (client._destroyed) return;

    try {
      await attempts(
        () => {
          return timeout(
            client._sender!.send(
              new Api.PingDelayDisconnect({
                pingId: bigInt(
                  getRandomInt(
                    Number.MIN_SAFE_INTEGER,
                    Number.MAX_SAFE_INTEGER,
                  ),
                ),
                disconnectDelay: PING_DISCONNECT_DELAY,
              }),
            ),
            PING_TIMEOUT,
          );
        },
        PING_FAIL_ATTEMPTS,
        PING_FAIL_INTERVAL,
      );
    } catch (_err) {
      if (client._reconnecting || client._sender!.userDisconnected) {
        continue;
      }

      await client.disconnect();
      await client.connect();
    }
    if (
      new Date().getTime() - (client._lastRequest || 0) >
        30 * 60 * 1000
    ) {
      try {
        await client.invoke(new Api.updates.GetState());
      } catch (_e) {
        // we don't care about errors here
      }
    }
  }
  await client.disconnect();
}

async function attempts(cb: CallableFunction, times: number, pause: number) {
  for (let i = 0; i < times; i++) {
    try {
      return await cb();
    } catch (err) {
      if (i === times - 1) {
        throw err;
      }

      await sleep(pause);
    }
  }
  return undefined;
}

// deno-lint-ignore no-explicit-any
function timeout(promise: Promise<any>, ms: number) {
  return Promise.race([
    promise,
    sleep(ms).then(() => Promise.reject(new Error("TIMEOUT"))),
  ]);
}
