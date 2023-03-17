import { AbstractTelegramClient } from "./abstract_telegram_client.ts";
import { TotalList } from "../helpers.ts";
import { EntityType_, entityType_ } from "../tl/helpers.ts";
import { getDisplayName } from "../utils.ts";
import { RequestIter } from "../request_iter.ts";
import { Api } from "../tl/api.js";
import { bigInt } from "../deps.ts";
import { IterParticipantsParams } from "./types.ts";

const MAX_PARTICIPANTS_CHUNK_SIZE = 200;

interface ParticipantsIterInterface {
  entity: Api.TypeEntityLike;
  // deno-lint-ignore no-explicit-any
  filter: any;
  offset?: number;
  search?: string;
  showTotal?: boolean;
}

export class _ParticipantsIter extends RequestIter {
  private filterEntity: ((entity: Api.TypeEntity) => boolean) | undefined;
  private requests?: Api.channels.GetParticipants[];

  async _init({
    entity,
    filter,
    offset,
    search,
    showTotal,
  }: ParticipantsIterInterface): Promise<boolean | void> {
    if (!offset) offset = 0;
    if (filter && filter.constructor === Function) {
      if (
        [
          Api.ChannelParticipantsBanned,
          Api.ChannelParticipantsKicked,
          Api.ChannelParticipantsSearch,
          Api.ChannelParticipantsContacts,
        ].includes(filter)
      ) {
        filter = new filter({
          q: "",
        });
      } else {
        filter = new filter();
      }
    }
    entity = await this.client.getInputEntity(entity);
    const ty = entityType_(entity);
    if (search && (filter || ty != EntityType_.CHANNEL)) {
      // We need to 'search' ourselves unless we have a PeerChannel
      search = search.toLowerCase();
      this.filterEntity = (entity: Api.TypeEntity) => {
        return (
          getDisplayName(entity)
            .toLowerCase()
            .includes(search!) ||
          ("username" in entity ? entity.username || "" : "")
            .toLowerCase()
            .includes(search!)
        );
      };
    } else {
      this.filterEntity = (_entity) => true;
    }
    // Only used for channels, but we should always set the attribute
    this.requests = [];
    if (ty == EntityType_.CHANNEL) {
      if (showTotal) {
        const channel = await this.client.invoke(
          new Api.channels.GetFullChannel({
            channel: entity,
          }),
        );
        if (!(channel.fullChat instanceof Api.ChatFull)) {
          this.total = channel.fullChat.participantsCount;
        }
      }
      if (this.total && this.total <= 0) {
        return false;
      }
      this.requests.push(
        new Api.channels.GetParticipants({
          channel: entity,
          filter: filter ||
            new Api.ChannelParticipantsSearch({
              q: search || "",
            }),
          offset,
          limit: MAX_PARTICIPANTS_CHUNK_SIZE,
          hash: bigInt.zero,
        }),
      );
    } else if (ty == EntityType_.CHAT) {
      if (!(typeof entity === "object" && "chatId" in entity)) {
        throw new Error(
          "Found chat without id " + JSON.stringify(entity),
        );
      }

      const full = await this.client.invoke(
        new Api.messages.GetFullChat({
          chatId: entity.chatId,
        }),
      );

      if (full.fullChat instanceof Api.ChatFull) {
        if (
          !(
            full.fullChat.participants instanceof
              Api.ChatParticipantsForbidden
          )
        ) {
          this.total = full.fullChat.participants.participants.length;
        } else {
          this.total = 0;
          return false;
        }

        const users = new Map<string, Api.TypeEntity>();
        for (const user of full.users) {
          users.set(user.id.toString(), user);
        }
        for (
          const participant of full.fullChat.participants
            .participants
        ) {
          const user = users.get(participant.userId.toString())!;
          if (!this.filterEntity(user)) {
            continue;
          }
          // deno-lint-ignore no-explicit-any
          (user as any).participant = participant;
          this.buffer?.push(user);
        }
        return true;
      }
    } else {
      this.total = 1;
      if (this.limit != 0) {
        const user = await this.client.getEntity(entity);
        if (this.filterEntity(user)) {
          // deno-lint-ignore no-explicit-any
          (user as any).participant = undefined;
          this.buffer?.push(user);
        }
      }
      return true;
    }
  }

  async _loadNextChunk(): Promise<boolean | undefined> {
    if (!this.requests?.length) {
      return true;
    }
    this.requests[0].limit = Math.min(
      this.limit - this.requests[0].offset,
      MAX_PARTICIPANTS_CHUNK_SIZE,
    );
    const results = [];
    for (const request of this.requests) {
      results.push(await this.client.invoke(request));
    }

    for (let i = this.requests.length - 1; i >= 0; i--) {
      const participants = results[i];
      if (
        participants instanceof
          Api.channels.ChannelParticipantsNotModified ||
        !participants.users.length
      ) {
        this.requests.splice(i, 1);
        continue;
      }

      this.requests[i].offset += participants.participants.length;
      const users = new Map<string, Api.TypeEntity>();
      for (const user of participants.users) {
        users.set(user.id.toString(), user);
      }
      for (const participant of participants.participants) {
        if (!("userId" in participant)) {
          continue;
        }
        const user = users.get(participant.userId.toString())!;
        if (this.filterEntity && !this.filterEntity(user)) {
          continue;
        }
        // deno-lint-ignore no-explicit-any
        (user as any).participant = participant;
        this.buffer?.push(user);
      }
    }
    return undefined;
  }

  // deno-lint-ignore no-explicit-any
  [Symbol.asyncIterator](): AsyncIterator<Api.User, any, undefined> {
    return super[Symbol.asyncIterator]();
  }
}

export function iterParticipants(
  client: AbstractTelegramClient,
  entity: Api.TypeEntityLike,
  { limit, filter, offset, search, showTotal = true }: IterParticipantsParams,
) {
  return new _ParticipantsIter(
    client,
    limit ?? Number.MAX_SAFE_INTEGER,
    {},
    {
      entity: entity,
      filter: filter,
      offset: offset ?? 0,
      search: search,
      showTotal: showTotal,
    },
  );
}

export async function getParticipants(
  client: AbstractTelegramClient,
  entity: Api.TypeEntityLike,
  params: IterParticipantsParams,
) {
  const it = client.iterParticipants(entity, params);
  const users = new TotalList<Api.User>();
  for await (const user of it) {
    users.push(user);
  }
  return users;
}
