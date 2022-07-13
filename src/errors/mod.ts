import { Api } from "../tl/api.js";
import { RPCError } from "./rpc_base_errors.ts";
import { rpcErrorRe } from "./rpc_error_list.ts";

export function RPCMessageToError(
  rpcError: Api.RpcError,
  request: Api.AnyRequest,
) {
  for (const [msgRegex, Cls] of rpcErrorRe) {
    const m = rpcError.errorMessage.match(msgRegex);
    if (m) {
      const capture = m.length === 2 ? parseInt(m[1]) : null;
      return new Cls({ request: request, capture: capture });
    }
  }
  return new RPCError(rpcError.errorMessage, request, rpcError.errorCode);
}

export * from "./common.ts";
export * from "./rpc_base_errors.ts";
export * from "./rpc_error_list.ts";
