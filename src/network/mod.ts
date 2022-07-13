export * from "./connection/connection.ts";
export * from "./connection/tcp_full.ts";
export * from "./connection/tcp_obfuscated.ts";
export * from "./connection/tcpa_bridged.ts";
export * from "./connection/tcpmt_proxy.ts";
export * from "./authenticator.ts";
export * from "./mtproto_plain_sender.ts";
export * from "./mtproto_sender.ts";
export * from "./mtproto_state.ts";
export * from "./request_state.ts";

export interface states {
  disconnected: -1;
  connected: 1;
  broken: 0;
}
