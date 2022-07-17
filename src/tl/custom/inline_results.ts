import { Api } from "../api.js";
import { InlineResult } from "./inline_result.ts";
import { AbstractTelegramClient } from "../../client/abstract_telegram_client.ts";

export class InlineResults extends Array<InlineResult> {
  private result: Api.messages.TypeBotResults;
  private queryId: Api.long;
  private readonly cacheTime: Api.int;
  private readonly _validUntil: number;
  private users: Api.TypeUser[];
  private gallery: boolean;
  private nextOffset: string | undefined;
  private switchPm: Api.TypeInlineBotSwitchPM | undefined;

  constructor(
    client: AbstractTelegramClient,
    original: Api.messages.TypeBotResults,
    entity?: Api.TypeEntityLike,
  ) {
    super(
      ...original.results.map(
        (res) => new InlineResult(client, res, original.queryId, entity),
      ),
    );
    this.result = original;
    this.queryId = original.queryId;
    this.cacheTime = original.cacheTime;
    this._validUntil = new Date().getTime() / 1000 + this.cacheTime;
    this.users = original.users;
    this.gallery = Boolean(original.gallery);
    this.nextOffset = original.nextOffset;
    this.switchPm = original.switchPm;
  }

  resultsValid() {
    return new Date().getTime() / 1000 < this._validUntil;
  }
}
