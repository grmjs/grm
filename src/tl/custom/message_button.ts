import { Api } from "../api.js";
import { Button } from "./button.ts";
import { computeCheck } from "../../password.ts";
import { AbstractTelegramClient } from "../../client/abstract_telegram_client.ts";
import type { ButtonLike } from "../../define.d.ts";

export class MessageButton {
  private readonly _client: AbstractTelegramClient;
  private readonly _chat: Api.TypeEntityLike;
  public readonly button: ButtonLike;
  private readonly _bot?: Api.TypeEntityLike;
  private readonly _msgId: Api.TypeMessageIDLike;

  constructor(
    client: AbstractTelegramClient,
    original: ButtonLike,
    chat: Api.TypeEntityLike,
    bot: Api.TypeEntityLike | undefined,
    msgId: Api.TypeMessageIDLike,
  ) {
    this.button = original;
    this._bot = bot;
    this._chat = chat;
    this._msgId = msgId;
    this._client = client;
  }

  get client() {
    return this._client;
  }

  get text() {
    return !(this.button instanceof Button) ? this.button.text : "";
  }

  // deno-lint-ignore getter-return
  get data() {
    if (this.button instanceof Api.KeyboardButtonCallback) {
      return this.button.data;
    }
  }

  // deno-lint-ignore getter-return
  get inlineQuery() {
    if (this.button instanceof Api.KeyboardButtonSwitchInline) {
      return this.button.query;
    }
  }

  // deno-lint-ignore getter-return
  get url() {
    if (this.button instanceof Api.KeyboardButtonUrl) {
      return this.button.url;
    }
  }

  async click({
    sharePhone = false,
    shareGeo = [0, 0],
    password,
  }: {
    sharePhone?: boolean | string | Api.InputMediaContact;
    shareGeo?: [number, number] | Api.InputMediaGeoPoint;
    password?: string;
  }) {
    if (this.button instanceof Api.KeyboardButton) {
      return this._client.sendMessage(this._chat, {
        message: this.button.text,
        parseMode: undefined,
      });
    } else if (this.button instanceof Api.KeyboardButtonCallback) {
      let encryptedPassword;
      if (password !== undefined) {
        const pwd = await this.client.invoke(
          new Api.account.GetPassword(),
        );
        encryptedPassword = await computeCheck(pwd, password);
      }
      const request = new Api.messages.GetBotCallbackAnswer({
        peer: this._chat,
        msgId: this._msgId,
        data: this.button.data,
        password: encryptedPassword,
      });
      try {
        return await this._client.invoke(request);
      } catch (e) {
        if (e.errorMessage === "BOT_RESPONSE_TIMEOUT") {
          return null;
        }
        throw e;
      }
    } else if (this.button instanceof Api.KeyboardButtonSwitchInline) {
      return this._client.invoke(
        new Api.messages.StartBot({
          bot: this._bot,
          peer: this._chat,
          startParam: this.button.query,
        }),
      );
    } else if (this.button instanceof Api.KeyboardButtonUrl) {
      return this.button.url;
    } else if (this.button instanceof Api.KeyboardButtonGame) {
      const request = new Api.messages.GetBotCallbackAnswer({
        peer: this._chat,
        msgId: this._msgId,
        game: true,
      });
      try {
        return await this._client.invoke(request);
      } catch (e) {
        if (e.errorMessage == "BOT_RESPONSE_TIMEOUT") {
          return null;
        }
        throw e;
      }
    } else if (this.button instanceof Api.KeyboardButtonRequestPhone) {
      if (!sharePhone) {
        throw new Error(
          "cannot click on phone buttons unless sharePhone=true",
        );
      }
      if (sharePhone === true || typeof sharePhone === "string") {
        const me = (await this._client.getMe()) as Api.User;
        sharePhone = new Api.InputMediaContact({
          phoneNumber: (sharePhone === true ? me.phone : sharePhone) || "",
          firstName: me.firstName || "",
          lastName: me.lastName || "",
          vcard: "",
        });
      }
      throw new Error("Not supported for now");
    } else if (this.button instanceof Api.InputWebFileGeoPointLocation) {
      if (!shareGeo) {
        throw new Error(
          "cannot click on geo buttons unless shareGeo=[longitude, latitude]",
        );
      }
      throw new Error("Not supported for now");
    }
  }
}
