import { Api } from "../tl/api.js";
import type { AuthKey } from "../crypto/authkey.ts";
import type { EntityLike } from "../define.d.ts";

export abstract class Session {
  abstract setDC(dcId: number, serverAddress: string, port: number): void;
  abstract get dcId(): number;
  abstract get serverAddress(): string;
  abstract get port(): number;
  abstract get authKey(): AuthKey | undefined;
  abstract set authKey(value: AuthKey | undefined);
  abstract load(): Promise<void>;
  abstract setAuthKey(authKey?: AuthKey, dcId?: number): void;
  abstract getAuthKey(dcId?: number): AuthKey | undefined;
  abstract getInputEntity(key: EntityLike): Api.TypeInputPeer;
  abstract close(): void;
  abstract save(): void;
  abstract delete(): void;
  // deno-lint-ignore no-explicit-any
  abstract processEntities(tlo: any): void;
}
