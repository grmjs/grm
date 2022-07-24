import { Api } from "../tl/api.js";
import {
  DateLike,
  FileLike,
  MarkupLike,
  MessageLike,
  OutFile,
  ProgressCallback,
} from "../define.d.ts";
import { CustomFile } from "../classes.ts";

export interface ParseInterface {
  parse: (message: string) => [string, Api.TypeMessageEntity[]];
  unparse: (text: string, entities: Api.TypeMessageEntity[]) => string;
}

export interface SendMessageParams {
  message?: MessageLike;
  replyTo?: number | Api.Message;
  attributes?: Api.TypeDocumentAttribute[];
  // deno-lint-ignore no-explicit-any
  parseMode?: any;
  formattingEntities?: Api.TypeMessageEntity[];
  linkPreview?: boolean;
  file?: FileLike | FileLike[];
  thumb?: FileLike;
  forceDocument?: false;
  clearDraft?: false;
  buttons?: MarkupLike;
  silent?: boolean;
  supportStreaming?: boolean;
  schedule?: DateLike;
  noforwards?: boolean;
  commentTo?: number | Api.Message;
}

export interface ForwardMessagesParams {
  messages: Api.TypeMessageIDLike | Api.TypeMessageIDLike[];
  fromPeer: Api.TypeEntityLike;
  silent?: boolean;
  schedule?: DateLike;
  noforwards?: boolean;
}

export interface EditMessageParams {
  message: Api.Message | number;
  text?: string;
  // deno-lint-ignore no-explicit-any
  parseMode?: any;
  formattingEntities?: Api.TypeMessageEntity[];
  linkPreview?: boolean;
  file?: FileLike;
  forceDocument?: false;
  buttons?: MarkupLike;
  schedule?: DateLike;
}

export interface UpdatePinMessageParams {
  notify?: boolean;
  pmOneSide?: boolean;
}

export interface MarkAsReadParams {
  maxId?: number;
  clearMentions?: boolean;
}

export interface MessageIterParams {
  entity: Api.TypeEntityLike;
  offsetId: number;
  minId: number;
  maxId: number;
  fromUser?: Api.TypeEntityLike;
  offsetDate: DateLike;
  addOffset: number;
  // deno-lint-ignore no-explicit-any
  filter: any;
  search: string;
  replyTo: Api.TypeMessageIDLike;
}

export interface IterMessagesParams {
  limit?: number;
  offsetDate?: DateLike;
  offsetId: number;
  maxId: number;
  minId: number;
  addOffset: number;
  search?: string;
  filter?: Api.TypeMessagesFilter | Api.TypeMessagesFilter[];
  fromUser?: Api.TypeEntityLike;
  waitTime?: number;
  ids?: number | number[] | Api.TypeInputMessage | Api.TypeInputMessage[];
  reverse?: boolean;
  replyTo?: number;
  scheduled: boolean;
}

export interface OnProgress {
  (progress: number): void;
  isCanceled?: boolean;
}

export interface UploadFileParams {
  file: File | CustomFile;
  workers: number;
  onProgress?: OnProgress;
}

export interface SendFileInterface {
  file: FileLike | FileLike[];
  caption?: string | string[];
  forceDocument?: boolean;
  fileSize?: number;
  clearDraft?: boolean;
  progressCallback?: OnProgress;
  replyTo?: Api.TypeMessageIDLike;
  attributes?: Api.TypeDocumentAttribute[];
  thumb?: FileLike;
  voiceNote?: boolean;
  videoNote?: boolean;
  supportsStreaming?: boolean;
  // deno-lint-ignore no-explicit-any
  parseMode?: any;
  formattingEntities?: Api.TypeMessageEntity[];
  silent?: boolean;
  scheduleDate?: number;
  buttons?: MarkupLike;
  workers?: number;
  noforwards?: boolean;
  commentTo?: number | Api.Message;
}

export interface IterParticipantsParams {
  limit?: number;
  search?: string;
  filter?: Api.TypeChannelParticipantsFilter;
  showTotal?: boolean;
}

export interface IterDialogsParams {
  limit?: number;
  offsetDate?: DateLike;
  offsetId?: number;
  offsetPeer?: Api.TypeEntityLike;
  ignorePinned?: boolean;
  ignoreMigrated?: boolean;
  folder?: number;
  archived?: boolean;
}

export interface DownloadFileParams {
  dcId: number;
  fileSize?: number;
  workers?: number;
  partSizeKb?: number;
  start?: number;
  end?: number;
  progressCallback?: progressCallback;
}

export interface DownloadFileParamsV2 {
  outputFile?: OutFile;
  dcId?: number;
  fileSize?: bigInt.BigInteger;
  partSizeKb?: number;
  progressCallback?: progressCallback;
  msgData?: [Api.TypeEntityLike, number];
}

export interface DownloadProfilePhotoParams {
  isBig?: boolean;
  outputFile?: OutFile;
}

export interface DirectDownloadIterInterface {
  fileLocation: Api.TypeInputFileLocation;
  dcId: number;
  offset: bigInt.BigInteger;
  stride: number;
  chunkSize: number;
  requestSize: number;
  fileSize: number;
  msgData: number;
}

export interface progressCallback {
  (
    downloaded: bigInt.BigInteger,
    fullSize: bigInt.BigInteger,
    // deno-lint-ignore no-explicit-any
    ...args: any[]
  ): void;
  isCanceled?: boolean;
  acceptsBuffer?: boolean;
}

export interface IterDownloadFunction {
  file?: Api.TypeMessageMedia | Api.TypeInputFile | Api.TypeInputFileLocation;
  offset?: bigInt.BigInteger;
  stride?: number;
  limit?: number;
  chunkSize?: number;
  requestSize: number;
  fileSize?: bigInt.BigInteger;
  dcId?: number;
  msgData?: [Api.TypeEntityLike, number];
}

export interface ReturnString {
  (): string;
}

export interface BotAuthParams {
  botAuthToken: string | ReturnString;
}

export interface ApiCredentials {
  apiId: number;
  apiHash: string;
}

export interface UserPasswordAuthParams {
  password?: (hint?: string) => MaybePromise<string>;
  onError: (err: Error) => Promise<boolean> | void;
}

export type MaybePromise<T> = T | Promise<T>;

export interface UserAuthParams {
  phoneNumber: string | (() => MaybePromise<string>);
  phoneCode: (isCodeViaApp?: boolean) => MaybePromise<string>;
  password?: (hint?: string) => MaybePromise<string>;
  firstAndLastNames?: () => Promise<[string, string?]>;
  qrCode?: (qrCode: { token: Buffer; expires: number }) => Promise<void>;
  onError: (err: Error) => Promise<boolean> | void;
  forceSMS?: boolean;
}

export interface QrCodeAuthParams extends UserPasswordAuthParams {
  qrCode?: (qrCode: { token: Buffer; expires: number }) => Promise<void>;
  onError: (err: Error) => Promise<boolean> | void;
}

export interface TwoFaParams {
  isCheckPassword?: boolean;
  currentPassword?: string;
  newPassword?: string;
  hint?: string;
  email?: string;
  emailCodeCallback?: (length: number) => Promise<string>;
  onEmailCodeError?: (err: Error) => void;
}

export interface DownloadMediaInterface {
  outputFile?: OutFile;
  thumb?: number | Api.TypePhotoSize;
  progressCallback?: ProgressCallback;
}

export interface FileToMediaInterface {
  file: FileLike;
  forceDocument?: boolean;
  fileSize?: number;
  progressCallback?: OnProgress;
  attributes?: Api.TypeDocumentAttribute[];
  thumb?: FileLike;
  voiceNote?: boolean;
  videoNote?: boolean;
  supportsStreaming?: boolean;
  mimeType?: string;
  asImage?: boolean;
  workers?: number;
}
