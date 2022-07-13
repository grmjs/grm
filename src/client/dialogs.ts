import { Api } from "../tl/api.js";
import { RequestIter } from "../request_iter.ts";
import { TelegramClient } from "./telegram_client.ts";
import { Dialog } from "../tl/custom/dialog.ts";
import { DateLike, EntityLike } from "../define.d.ts";
import { TotalList } from "../helpers.ts";
import { LogLevel } from "../extensions/logger.ts";
import { BigInteger } from "deps.ts";
import { getPeerId } from "../utils.ts";

const _MAX_CHUNK_SIZE = 100;

function _dialogMessageKey(peer: Api.TypePeer, messageId: number): string {
  // can't use arrays as keys for map :( need to convert to string.
  return (
    "" +
    [peer instanceof Api.PeerChannel ? peer.channelId : undefined, messageId]
  );
}

export interface DialogsIterInterface {
  offsetDate: number;
  offsetId: number;
  offsetPeer: Api.TypePeer;
  ignorePinned: boolean;
  ignoreMigrated: boolean;
  folder: number;
}

export class _DialogsIter extends RequestIter {
  private request?: Api.messages.GetDialogs;
  // deno-lint-ignore no-explicit-any
  private seen?: Set<any>;
  private offsetDate?: number;
  private ignoreMigrated?: boolean;

  async _init({
    offsetDate,
    offsetId,
    offsetPeer,
    ignorePinned,
    ignoreMigrated,
    folder,
  }: DialogsIterInterface) {
    this.request = new Api.messages.GetDialogs({
      offsetDate,
      offsetId,
      offsetPeer,
      limit: 1,
      hash: BigInteger.zero,
      excludePinned: ignorePinned,
      folderId: folder,
    });
    if (this.limit <= 0) {
      // Special case, get a single dialog and determine count
      const dialogs = await this.client.invoke(this.request);
      if ("count" in dialogs) {
        this.total = dialogs.count;
      } else {
        this.total = dialogs.dialogs.length;
      }

      return true;
    }

    this.seen = new Set();
    this.offsetDate = offsetDate;
    this.ignoreMigrated = ignoreMigrated;
  }

  // deno-lint-ignore no-explicit-any
  [Symbol.asyncIterator](): AsyncIterator<Dialog, any, undefined> {
    return super[Symbol.asyncIterator]();
  }

  async _loadNextChunk(): Promise<boolean | undefined> {
    if (!this.request || !this.seen || !this.buffer) {
      return;
    }
    this.request.limit = Math.min(this.left, _MAX_CHUNK_SIZE);
    const r = await this.client.invoke(this.request);
    if (r instanceof Api.messages.DialogsNotModified) {
      return;
    }
    if ("count" in r) {
      this.total = r.count;
    } else {
      this.total = r.dialogs.length;
    }
    const entities = new Map<string, Api.TypeUser | Api.TypeChat>();
    const messages = new Map<string, Api.Message>();

    for (const entity of [...r.users, ...r.chats]) {
      if (
        entity instanceof Api.UserEmpty ||
        entity instanceof Api.ChatEmpty
      ) {
        continue;
      }
      entities.set(getPeerId(entity), entity);
    }
    for (const m of r.messages) {
      const message = m as unknown as Api.Message;
      try {
        // todo make sure this never fails
        message._finishInit(this.client, entities, undefined);
      } catch (e) {
        this.client._log.error(
          `Got error while trying to finish init message with id ${m.id}`,
        );
        if (this.client._log.canSend(LogLevel.ERROR)) {
          console.error(e);
        }
      }
      messages.set(
        _dialogMessageKey(message.peerId!, message.id),
        message,
      );
    }

    for (const d of r.dialogs) {
      if (d instanceof Api.DialogFolder) {
        continue;
      }
      const message = messages.get(
        _dialogMessageKey(d.peer, d.topMessage),
      );
      if (this.offsetDate != undefined) {
        const date = message?.date!;
        if (date == undefined || date > this.offsetDate) {
          continue;
        }
      }
      const peerId = getPeerId(d.peer);
      if (!this.seen.has(peerId)) {
        this.seen.add(peerId);
        if (!entities.has(peerId)) continue;
        const cd = new Dialog(this.client, d, entities, message);
        if (
          !this.ignoreMigrated ||
          (cd.entity != undefined && "migratedTo" in cd.entity)
        ) {
          this.buffer.push(cd);
        }
      }
    }
    if (
      r.dialogs.length < this.request.limit ||
      !(r instanceof Api.messages.DialogsSlice)
    ) {
      return true;
    }
    let lastMessage;
    for (const dialog of r.dialogs.reverse()) {
      lastMessage = messages.get(
        _dialogMessageKey(dialog.peer, dialog.topMessage),
      );
      if (lastMessage) break;
    }
    this.request.excludePinned = true;
    this.request.offsetId = lastMessage ? lastMessage.id : 0;
    this.request.offsetDate = lastMessage ? lastMessage.date! : 0;
    this.request.offsetPeer = this.buffer[this.buffer.length - 1].inputEntity;
  }
}

export interface IterDialogsParams {
  limit?: number;
  offsetDate?: DateLike;
  offsetId?: number;
  offsetPeer?: EntityLike;
  ignorePinned?: boolean;
  ignoreMigrated?: boolean;
  folder?: number;
  archived?: boolean;
}

export function iterDialogs(
  client: TelegramClient,
  {
    limit = undefined,
    offsetDate = undefined,
    offsetId = 0,
    offsetPeer = new Api.InputPeerEmpty(),
    ignorePinned = false,
    ignoreMigrated = false,
    folder = undefined,
    archived = undefined,
  }: IterDialogsParams,
): _DialogsIter {
  if (archived != undefined) {
    folder = archived ? 1 : 0;
  }

  return new _DialogsIter(
    client,
    limit,
    {},
    {
      offsetDate,
      offsetId,
      offsetPeer,
      ignorePinned,
      ignoreMigrated,
      folder,
    },
  );
}

export async function getDialogs(
  client: TelegramClient,
  params: IterDialogsParams,
): Promise<TotalList<Dialog>> {
  return (await client.iterDialogs(params).collect()) as TotalList<Dialog>;
}
