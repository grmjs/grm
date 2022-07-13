import { Api } from "../tl/api.js";
import { generateRandomBytes } from "../helpers.ts";
import { computeCheck, computeDigest } from "../password.ts";
import { EmailUnconfirmedError } from "../errors/mod.ts";
import { Buffer } from "deps";
import type { TelegramClient } from "./telegram_client.ts";

export interface TwoFaParams {
  isCheckPassword?: boolean;
  currentPassword?: string;
  newPassword?: string;
  hint?: string;
  email?: string;
  emailCodeCallback?: (length: number) => Promise<string>;
  onEmailCodeError?: (err: Error) => void;
}

export async function updateTwoFaSettings(
  client: TelegramClient,
  {
    isCheckPassword,
    currentPassword,
    newPassword,
    hint = "",
    email,
    emailCodeCallback,
    onEmailCodeError,
  }: TwoFaParams,
) {
  if (!newPassword && !currentPassword) {
    throw new Error(
      "Neither `currentPassword` nor `newPassword` is present",
    );
  }

  if (email && !(emailCodeCallback && onEmailCodeError)) {
    throw new Error(
      "`email` present without `emailCodeCallback` and `onEmailCodeError`",
    );
  }

  const pwd = await client.invoke(new Api.account.GetPassword());

  if (!(pwd.newAlgo instanceof Api.PasswordKdfAlgoUnknown)) {
    pwd.newAlgo.salt1 = Buffer.concat([
      pwd.newAlgo.salt1,
      generateRandomBytes(32),
    ]);
  }
  if (!pwd.hasPassword && currentPassword) {
    currentPassword = undefined;
  }

  const password = currentPassword
    ? computeCheck(pwd, currentPassword!)
    : new Api.InputCheckPasswordEmpty();

  if (isCheckPassword) {
    await client.invoke(new Api.auth.CheckPassword({ password }));
    return;
  }
  if (pwd.newAlgo instanceof Api.PasswordKdfAlgoUnknown) {
    throw new Error("Unknown password encryption method");
  }
  try {
    await client.invoke(
      new Api.account.UpdatePasswordSettings({
        password,
        newSettings: new Api.account.PasswordInputSettings({
          newAlgo: pwd.newAlgo,
          newPasswordHash: newPassword
            ? computeDigest(pwd.newAlgo, newPassword)
            : Buffer.alloc(0),
          hint,
          email,
          // not explained what it does and it seems to always be set to empty in tdesktop
          newSecureSettings: undefined,
        }),
      }),
    );
  } catch (e) {
    if (e instanceof EmailUnconfirmedError) {
      while (true) {
        try {
          const code = await emailCodeCallback!(e.codeLength);
          if (!code) throw new Error("Code is empty");
          await client.invoke(new Api.account.ConfirmPasswordEmail({ code }));
          break;
        } catch (err) {
          onEmailCodeError!(err);
        }
      }
    } else {
      throw e;
    }
  }
}
