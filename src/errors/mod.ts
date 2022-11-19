import { Api } from "../tl/api.js";
import { RPCError } from "./rpc_base_errors.ts";
import { rpcErrorRe } from "./rpc_error_list.ts";

export class BadMessageError extends Error {
  static ErrorMessages = {
    16:
"msg_id too low (most likely, client time is wrong it would be worthwhile to \
synchronize it using msg_id notifications and re-send the original message \
with the “correct” msg_id or wrap it in a container with a new msg_id if the \
original message had waited too long on the client to be transmitted).",
    17:
"msg_id too high (similar to the previous case, the client time has to be \
synchronized, and the message re-sent with the correct msg_id).",
    18:
"Incorrect two lower order msg_id bits (the server expects client message \
msg_id to be divisible by 4).",
    19:
"Container msg_id is the same as msg_id of a previously received message \
(this must never happen).",
    20:
"Message too old, and it cannot be verified whether the server has received \
a message with this msg_id or not.",
    32:
"msg_seqno too low (the server has already received a message with a lower \
msg_id but with either a higher or an equal and odd seqno).",
    33:
"msg_seqno too high (similarly, there is a message with a higher msg_id but with \
either a lower or an equal and odd seqno).",
    34: "An even msg_seqno expected (irrelevant message), but odd received.",
    35: "Odd msg_seqno expected (relevant message), but even received.",
    48:
"Incorrect server salt (in this case, the bad_server_salt response is received with \
the correct salt, and the message is to be re-sent with it).",
    64: "Invalid container.",
  };

  private errorMessage: string;

  constructor(request: Api.AnyRequest, private code: number) {
    // deno-lint-ignore no-explicit-any
    let errorMessage = (BadMessageError.ErrorMessages as any)[code] ||
      `Unknown error code (this should not happen): ${code}.`;
    errorMessage += `  Caused by ${request.className}`;
    super(errorMessage);
    this.errorMessage = errorMessage;
  }
}

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
