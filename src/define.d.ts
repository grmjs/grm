import { Api } from "./tl/api.js";
import { CustomFile } from "./client/uploads.ts";
import { Button } from "./tl/custom/button.ts";
import { bigInt, Buffer } from "../deps.ts";

import TypeUser = Api.TypeUser;
import TypeChat = Api.TypeChat;
import TypeInputUser = Api.TypeInputUser;
import TypeInputChannel = Api.TypeInputChannel;

type ValueOf<T> = T[keyof T];
type Phone = string;
type Username = string;
type PeerID = number;

type Entity = Api.User | Api.Chat | Api.Channel | TypeUser | TypeChat;
type FullEntity =
  | Api.UserFull
  | Api.messages.ChatFull
  | Api.ChatFull
  | Api.ChannelFull;
type EntityLike =
  | bigInt.BigInteger
  | Phone
  | Username
  | PeerID
  | Api.TypePeer
  | Api.TypeInputPeer
  | Entity
  | FullEntity
  | TypeUser
  | TypeChat
  | TypeInputChannel
  | TypeInputUser;
type EntitiesLike = EntityLike[];

type MessageIDLike =
  | number
  | Api.Message
  | Api.MessageService
  | Api.TypeInputMessage;
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
  // | WritableStream
  // deno-lint-ignore ban-types
  | { write: Function; close?: Function };
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
