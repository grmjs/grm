import { Api } from "../tl/api.js";
import {
  getInputPeer,
  getPeer,
  getPeerId as getPeerId_,
  parseID,
  parsePhone,
  parseUsername,
  resolveId,
} from "../utils.ts";
import * as utils from "../utils.ts";
import { isArrayLike, returnBigInt, sleep } from "../helpers.ts";
import { EntityType_, entityType_ } from "../tl/helpers.ts";
import { AbstractTelegramClient } from "./abstract_telegram_client.ts";
import { bigInt } from "../../deps.ts";
import { LogLevel } from "../extensions/logger.ts";
import { MTProtoSender } from "../network/mtproto_sender.ts";
import {
  FloodTestPhoneWaitError,
  FloodWaitError,
  NetworkMigrateError,
  PhoneMigrateError,
  ServerError,
  UserMigrateError,
} from "../errors/mod.ts";

export async function invoke<R extends Api.AnyRequest>(
  client: AbstractTelegramClient,
  request: R,
  sender?: MTProtoSender,
): Promise<R["__response"]> {
  if (request.classType !== "request") {
    throw new Error("You can only invoke MTProtoRequests");
  }
  if (!sender) {
    sender = client._sender;
  }
  if (sender == undefined) {
    throw new Error(
      "Cannot send requests while disconnected. You need to call .connect()",
    );
  }

  await request.resolve(client, utils);
  client._lastRequest = new Date().getTime();
  let attempt: number;
  for (attempt = 0; attempt < client._requestRetries; attempt++) {
    try {
      const promise = sender.send(request);
      const result = await promise;
      client.session.processEntities(result);
      client._entityCache.add(result);
      return result;
    } catch (e) {
      if (
        e instanceof ServerError ||
        e.errorMessage === "RPC_CALL_FAIL" ||
        e.errorMessage === "RPC_MCGET_FAIL"
      ) {
        client._log.warn(
          `Telegram is having internal issues ${e.constructor.name}`,
        );
        await sleep(2000);
      } else if (
        e instanceof FloodWaitError ||
        e instanceof FloodTestPhoneWaitError
      ) {
        if (e.seconds <= client.floodSleepThreshold) {
          client._log.info(
            `Sleeping for ${e.seconds}s on flood wait (Caused by ${request.className})`,
          );
          await sleep(e.seconds * 1000);
        } else {
          throw e;
        }
      } else if (
        e instanceof PhoneMigrateError ||
        e instanceof NetworkMigrateError ||
        e instanceof UserMigrateError
      ) {
        client._log.info(`Phone migrated to ${e.newDc}`);
        const shouldRaise = e instanceof PhoneMigrateError ||
          e instanceof NetworkMigrateError;
        if (shouldRaise && (await client.isUserAuthorized())) {
          throw e;
        }
        await client._switchDC(e.newDc);
      } else {
        throw e;
      }
    }
  }
  throw new Error(`Request was unsuccessful ${attempt} time(s)`);
}

export async function getMe(
  client: AbstractTelegramClient,
  inputPeer = false,
): Promise<Api.InputPeerUser | Api.User> {
  if (inputPeer && client._selfInputPeer) {
    return client._selfInputPeer;
  }
  const me = (
    await client.invoke(
      new Api.users.GetUsers({ id: [new Api.InputUserSelf()] }),
    )
  )[0] as Api.User;
  client._bot = me.bot;
  if (!client._selfInputPeer) {
    client._selfInputPeer = getInputPeer(
      me,
      false,
    ) as Api.InputPeerUser;
  }
  return inputPeer ? client._selfInputPeer : me;
}

export async function isBot(client: AbstractTelegramClient) {
  if (client._bot === undefined) {
    const me = await client.getMe();
    if (me) {
      return !(me instanceof Api.InputPeerUser) ? me.bot : undefined;
    }
  }
  return client._bot;
}

export async function isUserAuthorized(client: AbstractTelegramClient) {
  try {
    await client.invoke(new Api.updates.GetState());
    return true;
  } catch (_e) {
    return false;
  }
}

export async function getEntity(
  client: AbstractTelegramClient,
  entity: Api.TypeEntityLike | Api.TypeEntityLike[],
): Promise<Api.TypeEntity | Api.TypeEntity[]> {
  const single = !isArrayLike(entity);
  let entityArray: Api.TypeEntityLike[] = [];
  if (isArrayLike<Api.TypeEntityLike>(entity)) {
    entityArray = entity;
  } else {
    entityArray.push(entity);
  }

  const inputs = [];
  for (const x of entityArray) {
    if (typeof x === "string") {
      const valid = parseID(x);
      if (valid) {
        inputs.push(await client.getInputEntity(valid));
      } else {
        inputs.push(x);
      }
    } else {
      inputs.push(await client.getInputEntity(x));
    }
  }
  // deno-lint-ignore no-explicit-any
  const lists = new Map<number, any[]>([
    [EntityType_.USER, []],
    [EntityType_.CHAT, []],
    [EntityType_.CHANNEL, []],
  ]);
  for (const x of inputs) {
    try {
      lists.get(entityType_(x))!.push(x);
    } catch (_e) {
      //
    }
  }
  let users = lists.get(EntityType_.USER)!;
  let chats = lists.get(EntityType_.CHAT)!;
  let channels = lists.get(EntityType_.CHANNEL)!;

  if (users.length) {
    users = await client.invoke(
      new Api.users.GetUsers({
        id: users,
      }),
    );
  }
  if (chats.length) {
    const chatIds = chats.map((x) => x.chatId);
    chats = (
      await client.invoke(new Api.messages.GetChats({ id: chatIds }))
    ).chats;
  }
  if (channels.length) {
    channels = (
      await client.invoke(new Api.channels.GetChannels({ id: channels }))
    ).chats;
  }
  // deno-lint-ignore no-explicit-any
  const idEntity = new Map<string, any>();

  for (const user of users) {
    idEntity.set(getPeerId_(user), user);
  }

  for (const channel of channels) {
    idEntity.set(getPeerId_(channel), channel);
  }

  for (const chat of chats) {
    idEntity.set(getPeerId_(chat), chat);
  }

  const result = [];
  for (const x of inputs) {
    if (typeof x === "string") {
      result.push(await _getEntityFromString(client, x));
    } else if (!(x instanceof Api.InputPeerSelf)) {
      result.push(idEntity.get(getPeerId_(x)));
    } else {
      for (const [, u] of idEntity.entries()) {
        if (u instanceof Api.User && u.self) {
          result.push(u);
          break;
        }
      }
    }
  }
  return single ? result[0] : result;
}

export async function getInputEntity(
  client: AbstractTelegramClient,
  peer: Api.TypeEntityLike,
): Promise<Api.TypeInputPeer> {
  try {
    return getInputPeer(peer);
  } catch (_e) {
    //
  }
  // Next in priority is having a peer (or its ID) cached in-memory
  try {
    if (typeof peer == "string") {
      const valid = parseID(peer);
      if (valid) {
        const res = client._entityCache.get(peer);
        if (res) return res;
      }
    }
    if (
      typeof peer === "number" ||
      typeof peer === "bigint" ||
      bigInt.isInstance(peer)
    ) {
      const res = client._entityCache.get(peer.toString());
      if (res) {
        return res;
      }
    }
    // 0x2d45687 == crc32(b'Peer')
    if (
      typeof peer == "object" &&
      !(bigInt.isInstance(peer)) &&
      peer.SUBCLASS_OF_ID === 0x2d45687
    ) {
      const res = client._entityCache.get(utils.getPeerId(peer));
      if (res) {
        return res;
      }
    }
  } catch (_e) {
    //
  }
  // Then come known strings that take precedence
  if (typeof peer == "string") {
    if (["me", "this", "self"].includes(peer)) {
      return new Api.InputPeerSelf();
    }
  }

  try {
    if (peer != undefined) {
      return client.session.getInputEntity(peer);
    }
  } catch (_e) {
    //
  }
  // Only network left to try
  if (typeof peer === "string") {
    return getInputPeer(await _getEntityFromString(client, peer));
  }

  if (typeof peer === "number") {
    peer = returnBigInt(peer);
  }
  peer = getPeer(peer);
  if (peer instanceof Api.PeerUser) {
    const users = await client.invoke(
      new Api.users.GetUsers({
        id: [
          new Api.InputUser({
            userId: peer.userId,
            accessHash: bigInt.zero,
          }),
        ],
      }),
    );
    if (users.length && !(users[0] instanceof Api.UserEmpty)) {
      return getInputPeer(users[0]);
    }
  } else if (peer instanceof Api.PeerChat) {
    return new Api.InputPeerChat({
      chatId: peer.chatId,
    });
  } else if (peer instanceof Api.PeerChannel) {
    try {
      const channels = await client.invoke(
        new Api.channels.GetChannels({
          id: [
            new Api.InputChannel({
              channelId: peer.channelId,
              accessHash: bigInt.zero,
            }),
          ],
        }),
      );

      return getInputPeer(channels.chats[0]);
    } catch (e) {
      if (client._log.canSend(LogLevel.ERROR)) {
        console.error(e);
      }
    }
  }
  throw new Error(
    `Could not find the input entity for ${JSON.stringify(peer)}.
       Please read https://` +
      "docs.telethon.dev/en/latest/concepts/entities.html to" +
      " find out more details.",
  );
}

export async function _getEntityFromString(
  client: AbstractTelegramClient,
  string: string,
) {
  const phone = parsePhone(string);
  if (phone) {
    try {
      const result = await client.invoke(
        new Api.contacts.GetContacts({
          hash: bigInt.zero,
        }),
      );
      if (!(result instanceof Api.contacts.ContactsNotModified)) {
        for (const user of result.users) {
          if (user instanceof Api.User && user.phone === phone) {
            return user;
          }
        }
      }
      // deno-lint-ignore no-explicit-any
    } catch (e: any) {
      if (e.errorMessage === "BOT_METHOD_INVALID") {
        throw new Error(
          "Cannot get entity by phone number as a " +
            "bot (try using integer IDs, not strings)",
        );
      }
      throw e;
    }
  }
  const id = parseID(string);
  if (id !== undefined) {
    return getInputEntity(client, id);
  } else if (["me", "this"].includes(string.toLowerCase())) {
    return client.getMe();
  } else {
    const { username, isInvite } = parseUsername(string);
    if (isInvite) {
      const invite = await client.invoke(
        new Api.messages.CheckChatInvite({
          hash: username,
        }),
      );
      if (invite instanceof Api.ChatInvite) {
        throw new Error(
          "Cannot get entity from a channel (or group) " +
            "that you are not part of. Join the group and retry",
        );
      } else if (invite instanceof Api.ChatInviteAlready) {
        return invite.chat;
      }
    } else if (username) {
      try {
        const result = await client.invoke(
          new Api.contacts.ResolveUsername({ username: username }),
        );
        const pid = getPeerId_(result.peer, false);
        if (result.peer instanceof Api.PeerUser) {
          for (const x of result.users) {
            if (returnBigInt(x.id).equals(returnBigInt(pid))) {
              return x;
            }
          }
        } else {
          for (const x of result.chats) {
            if (returnBigInt(x.id).equals(returnBigInt(pid))) {
              return x;
            }
          }
        }
      } catch (e) {
        if (e.errorMessage === "USERNAME_NOT_OCCUPIED") {
          throw new Error(`No user has "${username}" as username`);
        }
        throw e;
      }
    }
  }
  throw new Error(`Cannot find any entity corresponding to "${string}"`);
}

export async function getPeerId(
  client: AbstractTelegramClient,
  peer: Api.TypeEntityLike,
  addMark = true,
) {
  if (typeof peer == "string") {
    const valid = parseID(peer);
    if (valid) {
      return getPeerId_(peer, addMark);
    } else {
      peer = await client.getInputEntity(peer);
    }
  }
  if (
    typeof peer == "number" ||
    typeof peer == "bigint" ||
    bigInt.isInstance(peer)
  ) {
    return getPeerId_(peer, addMark);
  }
  if (
    typeof peer !== "string" &&
    (peer.SUBCLASS_OF_ID === 0x2d45687 || peer.SUBCLASS_OF_ID === 0xc91c90b6)
  ) {
    peer = await client.getInputEntity(peer);
  }
  if (peer instanceof Api.InputPeerSelf) {
    peer = await client.getMe(true);
  }
  return getPeerId_(peer, addMark);
}

export async function _getPeer(
  client: AbstractTelegramClient,
  peer: Api.TypeEntityLike,
) {
  if (!peer) return;
  const [i, cls] = resolveId(
    returnBigInt(await client.getPeerId(peer)),
  );
  return new cls({
    userId: i,
    channelId: i,
    chatId: i,
  });
}

export async function _getInputDialog(
  client: AbstractTelegramClient,
  // deno-lint-ignore no-explicit-any
  dialog: any,
) {
  try {
    if (dialog.SUBCLASS_OF_ID == 0xa21c9795) {
      // crc32(b'InputDialogPeer')
      dialog.peer = await client.getInputEntity(dialog.peer);
      return dialog;
    } else if (dialog.SUBCLASS_OF_ID == 0xc91c90b6) {
      // crc32(b'InputPeer')
      return new Api.InputDialogPeer({ peer: dialog });
    }
  } catch (_e) {
    //
  }
  return new Api.InputDialogPeer({ peer: dialog });
}

export async function _getInputNotify(
  client: AbstractTelegramClient,
  // deno-lint-ignore no-explicit-any
  notify: any,
) {
  try {
    if (notify.SUBCLASS_OF_ID == 0x58981615) {
      if (notify instanceof Api.InputNotifyPeer) {
        notify.peer = await client.getInputEntity(notify.peer);
      }
      return notify;
    }
  } catch (_e) {
    //
  }
  return new Api.InputNotifyPeer({
    peer: await client.getInputEntity(notify),
  });
}

export function _selfId(client: AbstractTelegramClient) {
  return client._selfInputPeer ? client._selfInputPeer.userId : undefined;
}
