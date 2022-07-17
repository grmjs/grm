import { Api } from "../tl/api.js";
import { InlineResults } from "../tl/custom/inline_results.ts";
import { AbstractTelegramClient } from "./abstract_telegram_client.ts";

import GetInlineBotResults = Api.messages.GetInlineBotResults;

export async function inlineQuery(
  client: AbstractTelegramClient,
  bot: Api.TypeEntityLike,
  query: string,
  entity?: Api.InputPeerSelf,
  offset?: string,
  geoPoint?: Api.TypeInputGeoPoint,
): Promise<InlineResults> {
  bot = await client.getInputEntity(bot);
  let peer: Api.TypeInputPeer = new Api.InputPeerSelf();
  if (entity) peer = await client.getInputEntity(entity);

  const result = await client.invoke(
    new GetInlineBotResults({
      bot: bot,
      peer: peer,
      query: query,
      offset: offset || "",
      geoPoint: geoPoint,
    }),
  );
  return new InlineResults(client, result, entity ? peer : undefined);
}
