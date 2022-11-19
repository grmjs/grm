import { bigInt, Buffer, WriteStream } from "../deps.ts";

type ValueOf<T> = T[keyof T];
type Phone = string;
type Username = string;
type PeerID = number;

type LocalPath = string;
type ExternalUrl = string;
type BotFileID = string;

type OutFile =
  | string
  | Buffer
  | WriteStream;
type ProgressCallback = (
  total: bigInt.BigInteger,
  downloaded: bigInt.BigInteger,
) => void;

type DateLike = number;
