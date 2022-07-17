import { Api } from "../tl/api.js";
import { AbstractTelegramClient } from "../client/abstract_telegram_client.ts";
import { EventBuilder, EventCommon } from "./common.ts";

export interface RawInterface {
  // deno-lint-ignore ban-types
  types?: Function[];
  func?: CallableFunction;
}

export class Raw extends EventBuilder {
  // deno-lint-ignore ban-types
  private readonly types?: Function[];

  constructor(params: RawInterface) {
    super({ func: params.func });
    this.types = params.types;
  }

  // deno-lint-ignore require-await
  async resolve(_client: AbstractTelegramClient) {
    this.resolved = true;
  }

  build(update: Api.TypeUpdate): Api.TypeUpdate {
    return update;
  }

  filter(event: EventCommon) {
    if (this.types) {
      let correct = false;
      for (const type of this.types) {
        if (event instanceof type) {
          correct = true;
          break;
        }
      }
      if (!correct) {
        return;
      }
    }
    return super.filter(event);
  }
}
