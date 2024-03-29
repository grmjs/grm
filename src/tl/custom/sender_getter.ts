import { Api } from "../api.js";
import { ChatGetter } from "./chat_getter.ts";
import { bigInt } from "../../deps.ts";
import { AbstractTelegramClient } from "../../client/abstract_telegram_client.ts";

interface SenderGetterConstructorInterface {
  senderId?: bigInt.BigInteger;
  sender?: Api.TypeEntity;
  inputSender?: Api.TypeInputPeer;
}

export class SenderGetter extends ChatGetter {
  _senderId?: bigInt.BigInteger;
  _sender?: Api.TypeEntity;
  _inputSender?: Api.TypeInputPeer;
  declare public _client?: AbstractTelegramClient;

  static initSenderClass(
    // deno-lint-ignore no-explicit-any
    c: any,
    { senderId, sender, inputSender }: SenderGetterConstructorInterface,
  ) {
    c._senderId = senderId;
    c._sender = sender;
    c._inputSender = inputSender;
    c._client = undefined;
  }

  get sender() {
    return this._sender;
  }

  async getSender() {
    if (
      this._client &&
      (!this._sender ||
        (this._sender instanceof Api.Channel && this._sender.min)) &&
      (await this.getInputSender())
    ) {
      try {
        this._sender = await this._client.getEntity(this._inputSender!);
      } catch (_e) {
        await this._refetchSender();
      }
    }

    return this._sender;
  }

  get inputSender() {
    if (!this._inputSender && this._senderId && this._client) {
      try {
        this._inputSender = this._client._entityCache.get(this._senderId);
      } catch (_e) {
        //
      }
    }
    return this._inputSender;
  }

  async getInputSender() {
    if (!this.inputSender && this._senderId && this._client) {
      await this._refetchSender();
    }
    return this._inputSender;
  }

  get senderId() {
    return this._senderId;
  }

  async _refetchSender() {}
}
