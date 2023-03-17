import { Api } from "../tl/api.js";
import { bigInt } from "../deps.ts";
import { UpdateConnectionState } from "../network/mod.ts";
import { getPeerId } from "../utils.ts";
import { getRandomInt, returnBigInt, sleep } from "../helpers.ts";
import type { Raw } from "../events/raw.ts";
import type { EventBuilder } from "../events/common.ts";
import { AbstractTelegramClient } from "./abstract_telegram_client.ts";

export class StopPropagation extends Error {}

export function on(client: AbstractTelegramClient, event?: EventBuilder) {
  // deno-lint-ignore no-explicit-any
  return (f: { (event: any): void }) => {
    client.addEventHandler(f, event);
    return f;
  };
}

export function addEventHandler(
  client: AbstractTelegramClient,
  callback: CallableFunction,
  event?: EventBuilder,
) {
  if (event === undefined) {
    // recursive imports :(
    import("../events/raw.ts").then((r) => {
      event = new r.Raw({}) as Raw;
      event.client = client;
      client._eventBuilders.push([event, callback]);
    });
  } else {
    event.client = client;
    client._eventBuilders.push([event, callback]);
  }
}

export function removeEventHandler(
  client: AbstractTelegramClient,
  callback: CallableFunction,
  event: EventBuilder,
) {
  client._eventBuilders = client._eventBuilders.filter(function (item) {
    return item[0] !== event && item[1] !== callback;
  });
}

export function listEventHandlers(client: AbstractTelegramClient) {
  return client._eventBuilders;
}

export function catchUp() {
  // TODO
}

export function _handleUpdate(
  client: AbstractTelegramClient,
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
  client: AbstractTelegramClient,
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
  client: AbstractTelegramClient,
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

export async function _updateLoop(
  client: AbstractTelegramClient,
): Promise<void> {
  while (client.connected) {
    try {
      await sleep(60 * 1000);
      if (!client._sender?._transportConnected()) {
        continue;
      }
      await client.invoke(
        new Api.Ping({
          pingId: bigInt(
            getRandomInt(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
          ),
        }),
      );
    } catch (_err) {
      return;
    }

    client.session.save();

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
}
