import { DefaultEventInterface, EventBuilder, EventCommon } from "./common.ts";
import { Api } from "../tl/api.js";
import { AbstractTelegramClient } from "../client/abstract_telegram_client.ts";
import { LogLevel } from "../extensions/logger.ts";
import { CustomMessage } from "../tl/custom/message.ts";

const ALBUM_DELAY = 500;

export class Album extends EventBuilder {
  declare func?: { (event: Album): boolean };

  constructor(albumParams: DefaultEventInterface) {
    const { chats, func, blacklistChats = false } = albumParams;
    super({ chats, blacklistChats, func });
  }

  build(update: Api.TypeUpdate, dispatch?: CallableFunction) {
    if (!("message" in update && update.message instanceof Api.Message)) {
      return;
    }

    const groupedId = update.message.groupedId;
    if (!groupedId) {
      return;
    }
    const albums = this.client!._ALBUMS;
    const oldTimeout = albums.get(groupedId.toString());
    const oldValues: Api.TypeUpdate[] = [];
    if (oldTimeout) {
      clearTimeout(oldTimeout[0]);
      oldValues.push(...oldTimeout[1]);
    }
    albums.set(groupedId.toString(), [
      setTimeout(() => {
        const values = albums.get(groupedId.toString());
        albums.delete(groupedId.toString());
        if (!values) {
          return;
        }
        const updates = values[1];

        if (!updates) {
          return;
        }
        const messages = new Array<CustomMessage>();
        for (const update of updates) {
          // there is probably an easier way
          if (
            "message" in update &&
            update.message instanceof Api.Message
          ) {
            messages.push(new CustomMessage(update.message));
          }
        }
        const event = new AlbumEvent(
          messages.map((v) => v.originalMessage!),
          values[1],
        );
        event._setClient(this.client!);
        event._entities = messages[0]._entities!;
        dispatch!(event);
      }, ALBUM_DELAY),
      [...oldValues, update],
    ]);
  }
}

export class AlbumEvent extends EventCommon {
  messages: CustomMessage[];
  originalUpdates:
    (Api.TypeUpdate & { _entities?: Map<string, Api.TypeEntity> })[];

  constructor(messages: Api.Message[], originalUpdates: Api.TypeUpdate[]) {
    super({
      msgId: messages[0].id,
      chatPeer: messages[0].peerId,
      broadcast: messages[0].post,
    });
    this.originalUpdates = originalUpdates;
    this.messages = messages.map((v) => new CustomMessage(v));
  }

  _setClient(client: AbstractTelegramClient) {
    super._setClient(client);
    for (let i = 0; i < this.messages.length; i++) {
      try {
        // todo make sure this never fails
        this.messages[i]._finishInit(
          client,
          this.originalUpdates[i]._entities || new Map(),
          undefined,
        );
      } catch (e) {
        client._log.error(
          "Got error while trying to finish init message with id " +
            this.messages[i].id,
        );
        if (client._log.canSend(LogLevel.ERROR)) {
          console.error(e);
        }
      }
    }
  }
}
