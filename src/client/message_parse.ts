import { Api } from "../tl/api.js";
import { getPeerId, sanitizeParseMode } from "../utils.ts";
import { AbstractTelegramClient } from "./abstract_telegram_client.ts";
import { isArrayLike } from "../helpers.ts";
import { EntityType_, entityType_ } from "../tl/helpers.ts";
import { bigInt } from "../../deps.ts";
import { CustomMessage } from "../tl/custom/message.ts";
import { ParseInterface } from "./types.ts";

export type messageEntities =
  | typeof Api.MessageEntityBold
  | typeof Api.MessageEntityItalic
  | typeof Api.MessageEntityStrike
  | typeof Api.MessageEntityCode
  | typeof Api.MessageEntityPre;

export const DEFAULT_DELIMITERS: { [key: string]: messageEntities } = {
  "**": Api.MessageEntityBold,
  __: Api.MessageEntityItalic,
  "~~": Api.MessageEntityStrike,
  "`": Api.MessageEntityCode,
  "```": Api.MessageEntityPre,
};

export async function _replaceWithMention(
  client: AbstractTelegramClient,
  entities: Api.TypeMessageEntity[],
  i: number,
  user: Api.TypeEntityLike,
) {
  try {
    entities[i] = new Api.InputMessageEntityMentionName({
      offset: entities[i].offset,
      length: entities[i].length,
      userId:
        (await client.getInputEntity(user)) as unknown as Api.TypeInputUser,
    });
    return true;
  } catch (_e) {
    return false;
  }
}

export async function _parseMessageText(
  client: AbstractTelegramClient,
  message: string,
  parseMode: false | string | ParseInterface,
): Promise<[string, Api.TypeMessageEntity[]]> {
  if (parseMode === false) {
    return [message, []];
  }
  if (parseMode === undefined) {
    if (client.parseMode === undefined) {
      return [message, []];
    }
    parseMode = client.parseMode as ParseInterface;
  } else if (typeof parseMode === "string") {
    parseMode = sanitizeParseMode(parseMode) as ParseInterface;
  }
  const [rawMessage, msgEntities] = parseMode.parse(message);
  for (let i = msgEntities.length - 1; i >= 0; i--) {
    const e = msgEntities[i];
    if (e instanceof Api.MessageEntityTextUrl) {
      const m = /^@|\+|tg:\/\/user\?id=(\d+)/.exec(e.url);
      if (m) {
        const userIdOrUsername = m[1] ? Number(m[1]) : e.url;
        const isMention = await _replaceWithMention(
          client,
          msgEntities,
          i,
          userIdOrUsername,
        );
        if (!isMention) msgEntities.splice(i, 1);
      }
    }
  }
  return [rawMessage, msgEntities];
}

export function _getResponseMessage(
  client: AbstractTelegramClient,
  // deno-lint-ignore no-explicit-any
  request: any,
  // deno-lint-ignore no-explicit-any
  result: any,
  // deno-lint-ignore no-explicit-any
  inputChat: any,
) {
  let updates = [];

  const entities = new Map();
  if (result instanceof Api.UpdateShort) {
    updates = [result.update];
  } else if (
    result instanceof Api.Updates ||
    result instanceof Api.UpdatesCombined
  ) {
    updates = result.updates;
    for (const x of [...result.users, ...result.chats]) {
      entities.set(getPeerId(x), x);
    }
  } else {
    return;
  }
  const randomToId = new Map<string, number>();
  const idToMessage = new Map<number, CustomMessage>();
  let schedMessage;
  for (const update of updates) {
    if (update instanceof Api.UpdateMessageID) {
      randomToId.set(update.randomId!.toString(), update.id);
    } else if (
      update instanceof Api.UpdateNewChannelMessage ||
      update instanceof Api.UpdateNewMessage
    ) {
      const message = new CustomMessage(
        update.message as unknown as Api.Message,
      );

      message._finishInit(
        client,
        entities,
        inputChat,
      );
      if ("randomId" in request || isArrayLike(request)) {
        idToMessage.set(
          update.message.id,
          message,
        );
      } else {
        return message;
      }
    } else if (
      update instanceof Api.UpdateEditMessage &&
      "peer" in request &&
      entityType_(request.peer) !== EntityType_.CHANNEL
    ) {
      const message = new CustomMessage(
        update.message as unknown as Api.Message,
      );
      message._finishInit(
        client,
        entities,
        inputChat,
      );
      if ("randomId" in request) {
        idToMessage.set(
          update.message.id,
          message,
        );
      } else if ("id" in request && request.id === update.message.id) {
        return message;
      }
    } else if (
      update instanceof Api.UpdateEditChannelMessage &&
      "peer" in request &&
      getPeerId(request.peer) ===
        getPeerId((update.message as unknown as Api.Message).peerId!)
    ) {
      if (request.id === update.message.id) {
        const message = new CustomMessage(
          update.message as unknown as Api.Message,
        );
        message._finishInit(
          client,
          entities,
          inputChat,
        );
        return message;
      }
    } else if (update instanceof Api.UpdateNewScheduledMessage) {
      const message = new CustomMessage(
        update.message as unknown as Api.Message,
      );
      message._finishInit(
        client,
        entities,
        inputChat,
      );
      schedMessage = message;
      idToMessage.set(
        update.message.id,
        message,
      );
    } else if (update instanceof Api.UpdateMessagePoll) {
      if (request.media.poll.id === update.pollId) {
        const m = new CustomMessage({
          id: request.id,
          peerId: getPeerId(request.peer),
          media: new Api.MessageMediaPoll({
            poll: update.poll!,
            results: update.results,
          }),
          message: "",
          date: 0,
        });
        m._finishInit(client, entities, inputChat);
        return m;
      }
    }
  }
  if (request === undefined) {
    return idToMessage;
  }
  let randomId;
  if (
    isArrayLike(request) ||
    typeof request === "number" ||
    bigInt.isInstance(request)
  ) {
    randomId = request;
  } else {
    randomId = request.randomId;
  }
  if (!randomId) {
    if (schedMessage) return schedMessage;
    client._log.warn(
      `No randomId in ${request} to map to. returning undefined for ${result}`,
    );
    return undefined;
  }
  if (!isArrayLike(randomId)) {
    const msg = idToMessage.get(randomToId.get(randomId.toString())!);
    if (!msg) {
      client._log.warn(
        `Request ${request.className} had missing message mapping ${result.className}`,
      );
    }
    return msg;
  }
  const final = [];
  let warned = false;
  for (const rnd of randomId) {
    // deno-lint-ignore no-explicit-any
    const tmp = randomToId.get((rnd as any).toString());
    if (!tmp) {
      warned = true;
      break;
    }
    const tmp2 = idToMessage.get(tmp);
    if (!tmp2) {
      warned = true;
      break;
    }
    final.push(tmp2);
  }
  if (warned) {
    client._log.warn(
      `Request ${request.className} had missing message mapping ${result.className}`,
    );
  }
  const finalToReturn = [];
  for (const rnd of randomId) {
    finalToReturn.push(
      // deno-lint-ignore no-explicit-any
      idToMessage.get(randomToId.get((rnd as any).toString())!),
    );
  }

  return finalToReturn;
}
