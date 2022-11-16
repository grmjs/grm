import { Api } from "./tl/api.js";
import { CustomFile } from "./classes.ts";
import { Button } from "./tl/custom/button.ts";
import { bigInt, Buffer, WriteStream } from "../deps.ts";

type ValueOf<T> = T[keyof T];
type Phone = string;
type Username = string;
type PeerID = number;

type EntitiesLike = Api.TypeEntityLike[];

type MessageLike = string | Api.Message;

type LocalPath = string;
type ExternalUrl = string;
type BotFileID = string;

type FileLike =
  | LocalPath
  | ExternalUrl
  | BotFileID
  | Buffer
  | Api.TypeMessageMedia
  | Api.TypeInputMedia
  | Api.TypeInputFile
  | Api.TypeInputFileLocation
  | File
  | Api.TypePhoto
  | Api.TypeDocument
  | CustomFile;

type OutFile =
  | string
  | Buffer
  | WriteStream;
type ProgressCallback = (
  total: bigInt.BigInteger,
  downloaded: bigInt.BigInteger,
) => void;
type ButtonLike = Api.TypeKeyboardButton | Button;

type MarkupLike =
  | Api.TypeReplyMarkup
  | ButtonLike
  | ButtonLike[]
  | ButtonLike[][];

type DateLike = number;
