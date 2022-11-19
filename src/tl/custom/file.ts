import { Api } from "../api.js";
import { _photoSizeByteCount } from "../../utils.ts";

export class File {
  private readonly media: Api.TypeFileLike;

  constructor(media: Api.TypeFileLike) {
    this.media = media;
  }

  get id() {
    throw new Error("Unsupported");
  }

  get name() {
    return this._fromAttr(Api.DocumentAttributeFilename, "fileName");
  }

  // deno-lint-ignore getter-return
  get mimeType() {
    if (this.media instanceof Api.Photo) {
      return "image/jpeg";
    } else if (this.media instanceof Api.Document) {
      return this.media.mimeType;
    }
  }

  get width() {
    return this._fromAttr(
      [Api.DocumentAttributeImageSize, Api.DocumentAttributeVideo],
      "w",
    );
  }

  get height() {
    return this._fromAttr(
      [Api.DocumentAttributeImageSize, Api.DocumentAttributeVideo],
      "h",
    );
  }

  get duration() {
    return this._fromAttr(
      [Api.DocumentAttributeAudio, Api.DocumentAttributeVideo],
      "duration",
    );
  }

  get title() {
    return this._fromAttr(Api.DocumentAttributeAudio, "title");
  }

  get performer() {
    return this._fromAttr(Api.DocumentAttributeAudio, "performer");
  }

  get emoji() {
    return this._fromAttr(Api.DocumentAttributeSticker, "alt");
  }

  get stickerSet() {
    return this._fromAttr(Api.DocumentAttributeSticker, "stickerset");
  }

  // deno-lint-ignore getter-return
  get size() {
    if (this.media instanceof Api.Photo) {
      return _photoSizeByteCount(this.media.sizes[-1]);
    } else if (this.media instanceof Api.Document) {
      return this.media.size;
    }
  }

  // deno-lint-ignore no-explicit-any
  _fromAttr(cls: any, field: string) {
    if (this.media instanceof Api.Document) {
      for (const attr of this.media.attributes) {
        if (attr instanceof cls) {
          return (attr as typeof cls)[field];
        }
      }
    }
  }
}
