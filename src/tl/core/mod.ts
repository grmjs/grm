import { GZIPPacked } from "./gzip_packed.ts";
import { RPCResult } from "./rpc_result.ts";
import { MessageContainer } from "./message_container.ts";

// deno-lint-ignore ban-types
export const coreObjects = new Map<number, Function>([
  [RPCResult.CONSTRUCTOR_ID, RPCResult],
  [GZIPPacked.CONSTRUCTOR_ID, GZIPPacked],
  [MessageContainer.CONSTRUCTOR_ID, MessageContainer],
]);

export * from "./gzip_packed.ts";
export * from "./message_container.ts";
export * from "./rpc_result.ts";
export * from "./tl_message.ts";
