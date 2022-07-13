import { Api } from "../tl/api.js";
import {
  getAppropriatedPartSize,
  getAttributes,
  getInputMedia,
  getMessageId,
  isImage,
} from "../utils.ts";
import {
  EntityLike,
  FileLike,
  MarkupLike,
  MessageIDLike,
} from "../define.d.ts";
import { TelegramClient } from "./telegram_client.ts";
import { _parseMessageText } from "./message_parse.ts";
import { getCommentData } from "./messages.ts";
import {
  generateRandomBytes,
  readBigIntFromBuffer,
  sleep,
} from "../helpers.ts";
import { FloodWaitError } from "../errors/mod.ts";
import { basename, bigInt, Buffer } from "deps.ts";

interface OnProgress {
  (progress: number): void;
  isCanceled?: boolean;
}

export interface UploadFileParams {
  file: File | CustomFile;
  workers: number;
  onProgress?: OnProgress;
}

export class CustomFile {
  name: string;
  size: number;
  path: string;
  buffer?: Buffer;

  constructor(name: string, size: number, path: string, buffer?: Buffer) {
    this.name = name;
    this.size = size;
    this.path = path;
    this.buffer = buffer;
  }
}

const KB_TO_BYTES = 1024;
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;
const _UPLOAD_TIMEOUT = 15 * 1000;
const DISCONNECT_SLEEP = 1000;

export async function uploadFile(
  client: TelegramClient,
  fileParams: UploadFileParams,
): Promise<Api.InputFile | Api.InputFileBig> {
  const { file, onProgress } = fileParams;
  let { workers } = fileParams;

  const { name, size } = file;
  const fileId = readBigIntFromBuffer(generateRandomBytes(8), true, true);
  const isLarge = size > LARGE_FILE_THRESHOLD;

  const partSize = getAppropriatedPartSize(bigInt(size)) * KB_TO_BYTES;
  const partCount = Math.floor((size + partSize - 1) / partSize);
  const buffer = Buffer.from(await fileToBuffer(file));
  // Make sure a new sender can be created before starting upload
  await client.getSender(client.session.dcId);

  if (!workers || !size) {
    workers = 1;
  }
  if (workers >= partCount) {
    workers = partCount;
  }

  let progress = 0;
  if (onProgress) {
    onProgress(progress);
  }

  for (let i = 0; i < partCount; i += workers) {
    const sendingParts = [];
    let end = i + workers;
    if (end > partCount) {
      end = partCount;
    }

    for (let j = i; j < end; j++) {
      const bytes = buffer.slice(j * partSize, (j + 1) * partSize);

      // eslint-disable-next-line no-loop-func
      sendingParts.push(
        (async (jMemo: number, bytesMemo: Buffer) => {
          while (true) {
            let sender;
            try {
              // We always upload from the DC we are in
              sender = await client.getSender(
                client.session.dcId,
              );
              await sender.send(
                isLarge
                  ? new Api.upload.SaveBigFilePart({
                    fileId,
                    filePart: jMemo,
                    fileTotalParts: partCount,
                    bytes: bytesMemo,
                  })
                  : new Api.upload.SaveFilePart({
                    fileId,
                    filePart: jMemo,
                    bytes: bytesMemo,
                  }),
              );
            } catch (err) {
              if (sender && !sender.isConnected()) {
                await sleep(DISCONNECT_SLEEP);
                continue;
              } else if (err instanceof FloodWaitError) {
                await sleep(err.seconds * 1000);
                continue;
              }
              throw err;
            }

            if (onProgress) {
              if (onProgress.isCanceled) {
                throw new Error("USER_CANCELED");
              }

              progress += 1 / partCount;
              onProgress(progress);
            }
            break;
          }
        })(j, bytes),
      );
    }

    await Promise.all(sendingParts);
  }

  return isLarge
    ? new Api.InputFileBig({
      id: fileId,
      parts: partCount,
      name,
    })
    : new Api.InputFile({
      id: fileId,
      parts: partCount,
      name,
      md5Checksum: "", // This is not a "flag", so not sure if we can make it optional.
    });
}

export interface SendFileInterface {
  file: FileLike | FileLike[];
  caption?: string | string[];
  forceDocument?: boolean;
  fileSize?: number;
  clearDraft?: boolean;
  progressCallback?: OnProgress;
  replyTo?: MessageIDLike;
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

interface FileToMediaInterface {
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

export async function _fileToMedia(
  client: TelegramClient,
  {
    file,
    forceDocument,
    progressCallback,
    attributes,
    thumb,
    voiceNote = false,
    videoNote = false,
    supportsStreaming = false,
    mimeType,
    asImage,
    workers = 1,
  }: FileToMediaInterface,
): Promise<{
  // deno-lint-ignore no-explicit-any
  fileHandle?: any;
  media?: Api.TypeInputMedia;
  image?: boolean;
}> {
  if (!file) {
    return { fileHandle: undefined, media: undefined, image: undefined };
  }
  const isImage_ = isImage(file);

  if (asImage === undefined) {
    asImage = isImage_ && !forceDocument;
  }
  if (
    typeof file === "object" &&
    !Buffer.isBuffer(file) &&
    !(file instanceof Api.InputFile) &&
    !(file instanceof Api.InputFileBig) &&
    !(file instanceof CustomFile) &&
    !("read" in file)
  ) {
    try {
      return {
        fileHandle: undefined,
        media: getInputMedia(file, {
          isPhoto: asImage,
          attributes: attributes,
          forceDocument: forceDocument,
          voiceNote: voiceNote,
          videoNote: videoNote,
          supportsStreaming: supportsStreaming,
        }),
        image: asImage,
      };
    } catch (_e) {
      return {
        fileHandle: undefined,
        media: undefined,
        image: isImage_,
      };
    }
  }
  let media;
  let fileHandle;
  let createdFile;

  if (file instanceof Api.InputFile || file instanceof Api.InputFileBig) {
    fileHandle = file;
  } else if (
    typeof file === "string" &&
    (file.startsWith("https://") || file.startsWith("http://"))
  ) {
    if (asImage) {
      media = new Api.InputMediaPhotoExternal({ url: file });
    } else {
      media = new Api.InputMediaDocumentExternal({ url: file });
    }
  } else if (!(typeof file === "string") || (await Deno.lstat(file)).isFile) {
    if (typeof file === "string") {
      createdFile = new CustomFile(
        basename(file),
        (await Deno.stat(file)).size,
        file,
      );
    } else if (
      (typeof File !== "undefined" && file instanceof File) ||
      file instanceof CustomFile
    ) {
      createdFile = file;
    } else {
      let name;
      if ("name" in file) {
        // @ts-ignore wut
        name = file.name;
      } else {
        name = "unnamed";
      }
      if (Buffer.isBuffer(file)) {
        createdFile = new CustomFile(name, file.length, "", file);
      }
    }
    if (!createdFile) {
      throw new Error(
        `Could not create file from ${JSON.stringify(file)}`,
      );
    }
    fileHandle = await uploadFile(client, {
      file: createdFile,
      onProgress: progressCallback,
      workers: workers,
    });
  } else {
    throw new Error(`"Not a valid path nor a url ${file}`);
  }
  if (media !== undefined) { //
  } else if (fileHandle === undefined) {
    throw new Error(
      `Failed to convert ${file} to media. Not an existing file or an HTTP URL`,
    );
  } else if (asImage) {
    media = new Api.InputMediaUploadedPhoto({
      file: fileHandle,
    });
  } else {
    // @ts-ignore x
    const res = getAttributes(file, {
      mimeType: mimeType,
      attributes: attributes,
      forceDocument: forceDocument && !isImage_,
      voiceNote: voiceNote,
      videoNote: videoNote,
      supportsStreaming: supportsStreaming,
      thumb: thumb,
    });
    attributes = res.attrs;
    mimeType = res.mimeType;

    let uploadedThumb;
    if (!thumb) {
      uploadedThumb = undefined;
    } else {
      // todo refactor
      if (typeof thumb === "string") {
        uploadedThumb = new CustomFile(
          basename(thumb),
          (await Deno.stat(thumb)).size,
          thumb,
        );
      } else if (typeof File !== "undefined" && thumb instanceof File) {
        uploadedThumb = thumb;
      } else {
        let name;
        if ("name" in thumb) {
          name = thumb.name;
        } else {
          name = "unnamed";
        }
        if (Buffer.isBuffer(thumb)) {
          uploadedThumb = new CustomFile(
            name,
            thumb.length,
            "",
            thumb,
          );
        }
      }
      if (!uploadedThumb) {
        throw new Error(`Could not create file from ${file}`);
      }
      uploadedThumb = await uploadFile(client, {
        file: uploadedThumb,
        workers: 1,
      });
    }
    media = new Api.InputMediaUploadedDocument({
      file: fileHandle,
      mimeType: mimeType!,
      attributes: attributes!,
      thumb: uploadedThumb,
      forceFile: forceDocument && !isImage_,
    });
  }
  return {
    fileHandle: fileHandle,
    media: media,
    image: asImage,
  };
}

export async function _sendAlbum(
  client: TelegramClient,
  entity: EntityLike,
  {
    file,
    caption,
    forceDocument = false,
    fileSize,
    clearDraft = false,
    progressCallback,
    replyTo,
    attributes,
    thumb,
    parseMode,
    voiceNote = false,
    videoNote = false,
    silent,
    supportsStreaming = false,
    scheduleDate,
    workers = 1,
    noforwards,
    commentTo,
  }: SendFileInterface,
) {
  entity = await client.getInputEntity(entity);
  let files = [];
  if (!Array.isArray(file)) {
    files = [file];
  } else {
    files = file;
  }
  if (!Array.isArray(caption)) {
    if (!caption) {
      caption = "";
    }
    caption = [caption];
  }
  const captions: [string, Api.TypeMessageEntity[]][] = [];
  for (const c of caption) {
    captions.push(await _parseMessageText(client, c, parseMode));
  }
  if (commentTo != undefined) {
    const discussionData = await getCommentData(client, entity, commentTo);
    entity = discussionData.entity;
    replyTo = discussionData.replyTo;
  } else {
    replyTo = getMessageId(replyTo);
  }
  const albumFiles = [];
  for (const file of files) {
    let { media } = await _fileToMedia(client, {
      file: file,
      forceDocument: forceDocument,
      fileSize: fileSize,
      progressCallback: progressCallback,
      attributes: attributes,
      thumb: thumb,
      voiceNote: voiceNote,
      videoNote: videoNote,
      supportsStreaming: supportsStreaming,
      workers: workers,
    });
    if (
      media instanceof Api.InputMediaUploadedPhoto ||
      media instanceof Api.InputMediaPhotoExternal
    ) {
      const r = await client.invoke(
        new Api.messages.UploadMedia({
          peer: entity,
          media,
        }),
      );
      if (r instanceof Api.MessageMediaPhoto) {
        media = getInputMedia(r.photo);
      }
    } else if (media instanceof Api.InputMediaUploadedDocument) {
      const r = await client.invoke(
        new Api.messages.UploadMedia({
          peer: entity,
          media,
        }),
      );
      if (r instanceof Api.MessageMediaDocument) {
        media = getInputMedia(r.document);
      }
    }
    let text = "";
    let msgEntities: Api.TypeMessageEntity[] = [];
    if (captions.length) {
      [text, msgEntities] = captions.shift()!;
    }
    albumFiles.push(
      new Api.InputSingleMedia({
        media: media!,
        message: text,
        entities: msgEntities,
      }),
    );
  }
  const result = await client.invoke(
    new Api.messages.SendMultiMedia({
      peer: entity,
      replyToMsgId: replyTo,
      multiMedia: albumFiles,
      silent: silent,
      scheduleDate: scheduleDate,
      clearDraft: clearDraft,
      noforwards: noforwards,
    }),
  );
  const randomIds = albumFiles.map((m) => m.randomId);
  return client._getResponseMessage(randomIds, result, entity) as Api.Message;
}

export async function sendFile(
  client: TelegramClient,
  entity: EntityLike,
  {
    file,
    caption,
    forceDocument = false,
    fileSize,
    clearDraft = false,
    progressCallback,
    replyTo,
    attributes,
    thumb,
    parseMode,
    formattingEntities,
    voiceNote = false,
    videoNote = false,
    buttons,
    silent,
    supportsStreaming = false,
    scheduleDate,
    workers = 1,
    noforwards,
    commentTo,
  }: SendFileInterface,
) {
  if (!file) {
    throw new Error("You need to specify a file");
  }
  if (!caption) caption = "";
  entity = await client.getInputEntity(entity);
  if (commentTo != undefined) {
    const discussionData = await getCommentData(client, entity, commentTo);
    entity = discussionData.entity;
    replyTo = discussionData.replyTo;
  } else {
    replyTo = getMessageId(replyTo);
  }
  if (Array.isArray(file)) {
    return await _sendAlbum(client, entity, {
      file: file,
      caption: caption,
      replyTo: replyTo,
      parseMode: parseMode,
      silent: silent,
      scheduleDate: scheduleDate,
      supportsStreaming: supportsStreaming,
      clearDraft: clearDraft,
      forceDocument: forceDocument,
    });
  }
  if (Array.isArray(caption)) {
    caption = caption[0] || "";
  }
  let msgEntities;
  if (formattingEntities != undefined) {
    msgEntities = formattingEntities;
  } else {
    [caption, msgEntities] = await _parseMessageText(
      client,
      caption,
      parseMode,
    );
  }

  const { media } = await _fileToMedia(client, {
    file: file,
    forceDocument: forceDocument,
    fileSize: fileSize,
    progressCallback: progressCallback,
    attributes: attributes,
    thumb: thumb,
    voiceNote: voiceNote,
    videoNote: videoNote,
    supportsStreaming: supportsStreaming,
    workers: workers,
  });
  if (media === undefined) {
    throw new Error(`Cannot use ${file} as file.`);
  }
  const markup = client.buildReplyMarkup(buttons);
  const request = new Api.messages.SendMedia({
    peer: entity,
    media: media,
    replyToMsgId: replyTo,
    message: caption,
    entities: msgEntities,
    replyMarkup: markup,
    silent: silent,
    scheduleDate: scheduleDate,
    clearDraft: clearDraft,
    noforwards: noforwards,
  });
  const result = await client.invoke(request);
  return client._getResponseMessage(request, result, entity) as Api.Message;
}

function fileToBuffer(file: File | CustomFile): Promise<Buffer> | Buffer {
  if (typeof File !== "undefined" && file instanceof File) {
    return new Response(file).arrayBuffer() as Promise<Buffer>;
  } else if (file instanceof CustomFile) {
    if (file.buffer !== undefined) return file.buffer;
    else return Deno.readFile(file.path) as unknown as Buffer;
  } else {
    throw new Error("Could not create buffer from file " + file);
  }
}
