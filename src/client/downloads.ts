import { Api } from "../tl/api.js";
import { AbstractTelegramClient } from "./abstract_telegram_client.ts";
import {
  getAppropriatedPartSize,
  getExtension,
  getFileInfo,
  getInputPeer,
  strippedPhotoToJpg,
} from "../utils.ts";
import { sleep } from "../helpers.ts";
import { OutFile, ProgressCallback } from "../define.d.ts";
import { RequestIter } from "../request_iter.ts";
import { MTProtoSender } from "../network/mtproto_sender.ts";
import { FileMigrateError } from "../errors/mod.ts";
import { BinaryWriter } from "../extensions/binary_writer.ts";
import {
  bigInt,
  Buffer,
  createWriteStream,
  join,
  resolve,
  WriteStream,
} from "../../deps.ts";
import {
  DirectDownloadIterInterface,
  DownloadFileParamsV2,
  DownloadMediaInterface,
  DownloadProfilePhotoParams,
  IterDownloadFunction,
  progressCallback,
} from "./types.ts";

const MIN_CHUNK_SIZE = 4096;
const TIMED_OUT_SLEEP = 1000;
const MAX_CHUNK_SIZE = 512 * 1024;

export class DirectDownloadIter extends RequestIter {
  protected request?: Api.upload.GetFile;
  private _sender?: MTProtoSender;
  private _timedOut = false;
  protected _stride?: number;
  protected _chunkSize?: number;
  protected _lastPart?: Buffer;
  declare protected buffer: Buffer[] | undefined;

  async _init({
    fileLocation,
    dcId,
    offset,
    stride,
    chunkSize,
    requestSize,
    fileSize,
  }: DirectDownloadIterInterface) {
    this.request = new Api.upload.GetFile({
      location: fileLocation,
      offset,
      limit: requestSize,
    });

    this.total = fileSize;
    this._stride = stride;
    this._chunkSize = chunkSize;
    this._lastPart = undefined;
    this._timedOut = false;
    this._sender = await this.client.getSender(dcId);
  }

  async _loadNextChunk(): Promise<boolean | undefined> {
    const current = await this._request();
    this.buffer!.push(current);
    if (current.length < this.request!.limit) {
      // we finished downloading
      this.left = this.buffer!.length;
      this.close();
      return true;
    } else {
      this.request!.offset = this.request!.offset.add(this._stride!);
    }
  }

  async _request(): Promise<Buffer> {
    try {
      this._sender = await this.client.getSender(this._sender!.dcId);
      const result = await this.client.invoke(
        this.request!,
        this._sender,
      );
      this._timedOut = false;
      if (result instanceof Api.upload.FileCdnRedirect) {
        throw new Error(
          "CDN Not supported. Please Add an issue in github",
        );
      }
      return result.bytes;
    } catch (e) {
      if (e.errorMessage == "TIMEOUT") {
        if (this._timedOut) {
          this.client._log.warn(
            "Got two timeouts in a row while downloading file",
          );
          throw e;
        }
        this._timedOut = true;
        this.client._log.info(
          "Got timeout while downloading file, retrying once",
        );
        await sleep(TIMED_OUT_SLEEP);
        return await this._request();
      } else if (e instanceof FileMigrateError) {
        this.client._log.info("File lives in another DC");
        this._sender = await this.client.getSender(e.newDc);
        return await this._request();
      } else if (e.errorMessage == "FILEREF_UPGRADE_NEEDED") {
        // TODO later
        throw e;
      } else {
        throw e;
      }
    }
  }

  close() {
    this.client._log.debug("Finished downloading file ...");
  }

  // deno-lint-ignore no-explicit-any
  [Symbol.asyncIterator](): AsyncIterator<Buffer, any, undefined> {
    return super[Symbol.asyncIterator]();
  }
}

export class GenericDownloadIter extends DirectDownloadIter {
  async _loadNextChunk(): Promise<boolean | undefined> {
    // 1. Fetch enough for one chunk
    let data = Buffer.alloc(0);

    //  1.1. ``bad`` is how much into the data we have we need to offset
    const bad = this.request!.offset.divide(
      this.request!.limit,
    ).toJSNumber();
    const before = this.request!.offset;

    // 1.2. We have to fetch from a valid offset, so remove that bad part
    this.request!.offset = this.request!.offset.subtract(bad);

    let done = false;
    while (!done && data.length - bad < this._chunkSize!) {
      const current = await this._request();
      this.request!.offset = this.request!.offset.add(
        this.request!.limit,
      );

      data = Buffer.concat([data, current]);
      done = current.length < this.request!.limit;
    }
    // 1.3 Restore our last desired offset
    this.request!.offset = before;

    // 2. Fill the buffer with the data we have
    // 2.1. The current chunk starts at ``bad`` offset into the data,
    //  and each new chunk is ``stride`` bytes apart of the other
    for (let i = bad; i < data.length; i += this._stride!) {
      this.buffer!.push(data.slice(i, i + this._chunkSize!));

      // 2.2. We will yield this offset, so move to the next one
      this.request!.offset = this.request!.offset.add(this._stride!);
    }

    // 2.3. If we are in the last chunk, we will return the last partial data
    if (done) {
      this.left = this.buffer!.length;
      this.close();
      return;
    }

    // 2.4 If we are not done, we can't return incomplete chunks.
    if (this.buffer![this.buffer!.length - 1].length != this._chunkSize) {
      this._lastPart = this.buffer!.pop();
      //   3. Be careful with the offsets. Re-fetching a bit of data
      //   is fine, since it greatly simplifies things.
      // TODO Try to not re-fetch data
      this.request!.offset = this.request!.offset.subtract(this._stride!);
    }
  }
}

export function iterDownload(
  client: AbstractTelegramClient,
  {
    file,
    offset = bigInt.zero,
    stride,
    limit,
    chunkSize,
    requestSize = MAX_CHUNK_SIZE,
    fileSize,
    dcId,
    msgData,
  }: IterDownloadFunction,
) {
  // we're ignoring here to make it more flexible (which is probably a bad idea)
  // @ts-ignore x
  const info = getFileInfo(file);
  if (info.dcId != undefined) {
    dcId = info.dcId;
  }
  if (fileSize == undefined) {
    fileSize = info.size;
  }

  file = info.location;

  if (chunkSize == undefined) {
    chunkSize = requestSize;
  }

  if (limit == undefined && fileSize != undefined) {
    limit = Math.floor(
      fileSize.add(chunkSize).subtract(1).divide(chunkSize).toJSNumber(),
    );
  }
  if (stride == undefined) {
    stride = chunkSize;
  } else if (stride < chunkSize) {
    throw new Error("Stride must be >= chunkSize");
  }

  requestSize -= requestSize % MIN_CHUNK_SIZE;

  if (requestSize < MIN_CHUNK_SIZE) {
    requestSize = MIN_CHUNK_SIZE;
  } else if (requestSize > MAX_CHUNK_SIZE) {
    requestSize = MAX_CHUNK_SIZE;
  }
  let cls;
  if (
    chunkSize == requestSize &&
    offset!.divide(MAX_CHUNK_SIZE).eq(bigInt.zero) &&
    stride % MIN_CHUNK_SIZE == 0 &&
    (limit == undefined || offset!.divide(limit).eq(bigInt.zero))
  ) {
    cls = DirectDownloadIter;
    client._log.info(
      `Starting direct file download in chunks of ${requestSize} at ${offset}, stride ${stride}`,
    );
  } else {
    cls = GenericDownloadIter;
    client._log.info(
      `Starting indirect file download in chunks of ${requestSize} at ${offset}, stride ${stride}`,
    );
  }
  return new cls(
    client,
    limit,
    {},
    {
      fileLocation: file,
      dcId,
      offset,
      stride,
      chunkSize,
      requestSize,
      fileSize,
      msgData,
    },
  );
}

function getWriter(outputFile?: OutFile) {
  if (!outputFile || Buffer.isBuffer(outputFile)) {
    return new BinaryWriter(Buffer.alloc(0));
  } else if (typeof outputFile == "string") {
    return createWriteStream(outputFile);
  } else {
    return outputFile;
  }
}

function closeWriter(writer: WriteStream | BinaryWriter) {
  if ("close" in writer && writer.close) {
    writer.close();
  }
}

// deno-lint-ignore no-explicit-any
function returnWriterValue(writer: any): Buffer | string | undefined {
  if (writer instanceof BinaryWriter) {
    return writer.getValue();
  }
  if (writer instanceof WriteStream) {
    const { path } = writer;
    if (typeof path == "string") {
      return resolve(path);
    } else {
      return Buffer.from(path);
    }
  }
}

export async function downloadFileV2(
  client: AbstractTelegramClient,
  inputLocation: Api.TypeInputFileLocation,
  {
    outputFile = undefined,
    partSizeKb = undefined,
    fileSize = undefined,
    progressCallback = undefined,
    dcId = undefined,
    msgData = undefined,
  }: DownloadFileParamsV2,
) {
  if (!partSizeKb) {
    if (!fileSize) {
      partSizeKb = 64;
    } else {
      partSizeKb = getAppropriatedPartSize(fileSize);
    }
  }

  const partSize = Math.floor(partSizeKb * 1024);
  if (partSize % MIN_CHUNK_SIZE != 0) {
    throw new Error("The part size must be evenly divisible by 4096");
  }
  const writer = getWriter(outputFile);

  let downloaded = bigInt.zero;
  try {
    for await (
      const chunk of iterDownload(client, {
        file: inputLocation,
        requestSize: partSize,
        dcId: dcId,
        msgData: msgData,
      })
    ) {
      await writer.write(chunk);
      if (progressCallback) {
        progressCallback(
          downloaded,
          bigInt(fileSize || bigInt.zero),
        );
      }
      downloaded = downloaded.add(chunk.length);
    }
    return returnWriterValue(writer);
  } finally {
    closeWriter(writer);
  }
}

export function downloadMedia(
  client: AbstractTelegramClient,
  messageOrMedia: Api.Message | Api.TypeMessageMedia,
  outputFile?: OutFile,
  thumb?: number | Api.TypePhotoSize,
  progressCallback?: ProgressCallback,
): Promise<Buffer | string | undefined> | Buffer {
  let msgData: [Api.TypeEntityLike, number] | undefined;
  let date;
  let media;

  if (messageOrMedia instanceof Api.Message) {
    media = messageOrMedia.media;
    date = messageOrMedia.date;
    msgData = messageOrMedia.inputChat
      ? [messageOrMedia.inputChat, messageOrMedia.id]
      : undefined;
  } else {
    media = messageOrMedia;
    date = Date.now();
  }
  if (typeof media == "string") {
    throw new Error("not implemented");
  }
  if (media instanceof Api.MessageMediaWebPage) {
    if (media.webpage instanceof Api.WebPage) {
      media = media.webpage.document || media.webpage.photo;
    }
  }
  if (media instanceof Api.MessageMediaPhoto || media instanceof Api.Photo) {
    return _downloadPhoto(
      client,
      media,
      outputFile,
      date,
      thumb,
      progressCallback,
    );
  } else if (
    media instanceof Api.MessageMediaDocument ||
    media instanceof Api.Document
  ) {
    return _downloadDocument(
      client,
      media,
      outputFile,
      date,
      thumb,
      progressCallback,
      msgData,
    );
  } else if (media instanceof Api.MessageMediaContact) {
    return _downloadContact(client, media, {});
  } else if (
    media instanceof Api.WebDocument ||
    media instanceof Api.WebDocumentNoProxy
  ) {
    return _downloadWebDocument(client, media, {});
  } else {
    return Buffer.alloc(0);
  }
}

export async function _downloadDocument(
  client: AbstractTelegramClient,
  doc: Api.MessageMediaDocument | Api.TypeDocument,
  outputFile: OutFile | undefined,
  date: number,
  thumb?: number | string | Api.TypePhotoSize,
  progressCallback?: ProgressCallback,
  msgData?: [Api.TypeEntityLike, number],
): Promise<Buffer | string | undefined> {
  if (doc instanceof Api.MessageMediaDocument) {
    if (!doc.document) return Buffer.alloc(0);
    doc = doc.document;
  }
  if (!(doc instanceof Api.Document)) {
    return Buffer.alloc(0);
  }
  let size;
  if (thumb == undefined) {
    outputFile = getProperFilename(
      outputFile,
      "document",
      "." + (getExtension(doc) || "bin"),
      date,
    );
  } else {
    outputFile = getProperFilename(outputFile, "photo", ".jpg", date);
    size = getThumb(doc.thumbs || [], thumb);
    if (
      size instanceof Api.PhotoCachedSize ||
      size instanceof Api.PhotoStrippedSize
    ) {
      return _downloadCachedPhotoSize(size, outputFile);
    }
  }
  return await downloadFileV2(
    client,
    new Api.InputDocumentFileLocation({
      id: doc.id,
      accessHash: doc.accessHash,
      fileReference: doc.fileReference,
      thumbSize: size ? size.type : "",
    }),
    {
      outputFile: outputFile,
      fileSize: size && "size" in size ? bigInt(size.size) : doc.size,
      progressCallback: progressCallback,
      msgData: msgData,
    },
  );
}

export function _downloadContact(
  _client: AbstractTelegramClient,
  _media: Api.MessageMediaContact,
  _args: DownloadMediaInterface,
): Promise<Buffer> {
  throw new Error("not implemented");
}

export function _downloadWebDocument(
  _client: AbstractTelegramClient,
  _media: Api.WebDocument | Api.WebDocumentNoProxy,
  _args: DownloadMediaInterface,
): Promise<Buffer> {
  throw new Error("not implemented");
}

function getThumb(
  thumbs: (Api.TypePhotoSize | Api.VideoSize)[],
  thumb?: number | string | Api.TypePhotoSize | Api.VideoSize,
) {
  function sortThumb(thumb: Api.TypePhotoSize | Api.VideoSize) {
    if (thumb instanceof Api.PhotoStrippedSize) {
      return thumb.bytes.length;
    }
    if (thumb instanceof Api.PhotoCachedSize) {
      return thumb.bytes.length;
    }
    if (thumb instanceof Api.PhotoSize) {
      return thumb.size;
    }
    if (thumb instanceof Api.PhotoSizeProgressive) {
      return Math.max(...thumb.sizes);
    }
    if (thumb instanceof Api.VideoSize) {
      return thumb.size;
    }
    return 0;
  }

  thumbs = thumbs.sort((a, b) => sortThumb(a) - sortThumb(b));
  const correctThumbs = [];
  for (const t of thumbs) {
    if (!(t instanceof Api.PhotoPathSize)) {
      correctThumbs.push(t);
    }
  }
  if (thumb == undefined) {
    return correctThumbs.pop();
  } else if (typeof thumb == "number") {
    return correctThumbs[thumb];
  } else if (typeof thumb == "string") {
    for (const t of correctThumbs) {
      if (t.type == thumb) {
        return t;
      }
    }
  } else if (
    thumb instanceof Api.PhotoSize ||
    thumb instanceof Api.PhotoCachedSize ||
    thumb instanceof Api.PhotoStrippedSize ||
    thumb instanceof Api.VideoSize
  ) {
    return thumb;
  }
}

export async function _downloadCachedPhotoSize(
  size: Api.PhotoCachedSize | Api.PhotoStrippedSize,
  outputFile?: OutFile,
) {
  // No need to download anything, simply write the bytes
  let data: Buffer;
  if (size instanceof Api.PhotoStrippedSize) {
    data = strippedPhotoToJpg(size.bytes);
  } else {
    data = size.bytes;
  }

  const writer = getWriter(outputFile);
  try {
    await writer.write(data);
  } finally {
    closeWriter(writer);
  }

  return returnWriterValue(writer);
}

function getProperFilename(
  file: OutFile | undefined,
  fileType: string,
  extension: string,
  date: number,
) {
  if (!file || typeof file != "string") {
    return file;
  }

  if (Deno.lstatSync(file).isDirectory) {
    const fullName = fileType + date + extension;
    return join(file, fullName);
  }
  return file;
}

export function _downloadPhoto(
  client: AbstractTelegramClient,
  photo: Api.MessageMediaPhoto | Api.Photo,
  file?: OutFile,
  date?: number,
  thumb?: number | string | Api.TypePhotoSize,
  progressCallback?: progressCallback,
): Promise<Buffer | string | undefined> | Buffer {
  if (photo instanceof Api.MessageMediaPhoto) {
    if (photo.photo instanceof Api.PhotoEmpty || !photo.photo) {
      return Buffer.alloc(0);
    }
    photo = photo.photo;
  }
  if (!(photo instanceof Api.Photo)) {
    return Buffer.alloc(0);
  }
  const photoSizes = [...(photo.sizes || []), ...(photo.videoSizes || [])];
  const size = getThumb(photoSizes, thumb);
  if (!size || size instanceof Api.PhotoSizeEmpty) {
    return Buffer.alloc(0);
  }
  if (!date) {
    date = Date.now();
  }

  file = getProperFilename(file, "photo", ".jpg", date);
  if (
    size instanceof Api.PhotoCachedSize ||
    size instanceof Api.PhotoStrippedSize
  ) {
    return _downloadCachedPhotoSize(size, file);
  }
  let fileSize: number;
  if (size instanceof Api.PhotoSizeProgressive) {
    fileSize = Math.max(...size.sizes);
  } else {
    fileSize = size.size;
  }

  return downloadFileV2(
    client,
    new Api.InputPhotoFileLocation({
      id: photo.id,
      accessHash: photo.accessHash,
      fileReference: photo.fileReference,
      thumbSize: size.type,
    }),
    {
      outputFile: file,
      fileSize: bigInt(fileSize),
      progressCallback: progressCallback,
      dcId: photo.dcId,
    },
  );
}

export async function downloadProfilePhoto(
  client: AbstractTelegramClient,
  entity: Api.TypeEntityLike,
  fileParams: DownloadProfilePhotoParams,
) {
  let photo;
  if (typeof entity == "object" && "photo" in entity) {
    photo = entity.photo;
  } else {
    entity = await client.getEntity(entity);
    if (typeof entity == "object" && "photo" in entity) {
      photo = entity.photo;
    } else {
      throw new Error(
        `Could not get photo from ${
          entity && typeof entity == "object" && "className" in entity
            ? entity.className
            : undefined
        }`,
      );
    }
  }
  let dcId;
  let loc;
  if (
    photo instanceof Api.UserProfilePhoto ||
    photo instanceof Api.ChatPhoto
  ) {
    dcId = photo.dcId;
    loc = new Api.InputPeerPhotoFileLocation({
      peer: getInputPeer(entity),
      photoId: photo.photoId,
      big: fileParams.isBig,
    });
  } else {
    return Buffer.alloc(0);
  }
  return client.downloadFile(loc, {
    dcId,
    outputFile: fileParams.outputFile,
  });
}
