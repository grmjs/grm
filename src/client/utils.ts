import { Api } from "../tl/api.js";
import { getAttributes, getInputMedia, isImage } from "../utils.ts";
import { AbstractTelegramClient } from "./abstract_telegram_client.ts";
import { _parseMessageText } from "./message_parse.ts";
import { basename, Buffer } from "../deps.ts";
import { CustomFile } from "../classes.ts";
import { FileToMediaInterface } from "./types.ts";

export async function _fileToMedia(
  client: AbstractTelegramClient,
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
    fileHandle = await client.uploadFile({
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
      uploadedThumb = await client.uploadFile({
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
