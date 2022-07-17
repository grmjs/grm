// deno-lint-ignore-file no-explicit-any
import { Api } from "./tl/api.js";
import { ParseInterface } from "./client/types.ts";
import { MarkdownParser } from "./extensions/markdown.ts";
import { HTMLParser } from "./extensions/html.ts";
import { CustomFile } from "./classes.ts";
import { returnBigInt } from "./helpers.ts";
import {
  bigInt,
  Buffer,
  getExtension as mGetExtension,
  getType,
} from "../deps.ts";

import TypeInputFile = Api.TypeInputFile;

function _raiseCastFail(entity: any, target: string): never {
  let toWrite = entity;
  if (typeof entity === "object" && "className" in entity) {
    toWrite = entity.className;
  }
  throw new Error(`Cannot cast ${toWrite} to any kind of ${target}`);
}

export function resolveId(
  markedId: bigInt.BigInteger,
): [
  bigInt.BigInteger,
  typeof Api.PeerUser | typeof Api.PeerChannel | typeof Api.PeerChat,
] {
  if (markedId.greaterOrEquals(bigInt.zero)) {
    return [markedId, Api.PeerUser];
  }

  const m = markedId.toString().match(/-100([^0]\d*)/);
  if (m) return [bigInt(m[1]), Api.PeerChannel];
  return [markedId.negate(), Api.PeerChat];
}

export function parseID(id: string) {
  const isValid = /^(-?[0-9][0-9]*)$/.test(id);
  return isValid ? bigInt(id) : undefined;
}

export function parsePhone(phone: string) {
  phone = phone.toString().replace(/[()\s-]/gm, "");
  if (phone.startsWith("+") && phone.split("+").length - 1 === 1) {
    return !isNaN(Number(phone)) ? phone.replace("+", "") : undefined;
  }
}

export function rtrim(s: string, mask: string) {
  while (~mask.indexOf(s[s.length - 1])) {
    s = s.slice(0, -1);
  }
  return s;
}

const USERNAME_RE = new RegExp(
  "@|(?:https?:\\/\\/)?(?:www\\.)?" +
    "(?:telegram\\.(?:me|dog)|t\\.me)\\/(@|joinchat\\/)?",
  "i",
);
const TG_JOIN_RE = new RegExp("tg:\\/\\/(join)\\?invite=", "i");
const VALID_USERNAME_RE = new RegExp(
  "^([a-z]((?!__)[\\w\\d]){3,30}[a-z\\d]|gif|vid|" +
    "pic|bing|wiki|imdb|bold|vote|like|coub)$",
  "i",
);

export function parseUsername(
  username: string,
): { username?: string; isInvite: boolean } {
  username = username.trim();
  const m = username.match(USERNAME_RE) || username.match(TG_JOIN_RE);
  if (m) {
    username = username.replace(m[0], "");
    if (m[1]) {
      return {
        username: username,
        isInvite: true,
      };
    } else {
      username = rtrim(username, "/");
    }
  }
  if (username.match(VALID_USERNAME_RE)) {
    return {
      username: username.toLowerCase(),
      isInvite: false,
    };
  } else {
    return {
      username: undefined,
      isInvite: false,
    };
  }
}

export function getInputPeer(
  entity: any,
  allowSelf = true,
  checkHash = true,
): Api.TypeInputPeer {
  if (entity.SUBCLASS_OF_ID === undefined) {
    // e.g. custom.Dialog (can't cyclic import).
    if (allowSelf && "inputEntity" in entity) {
      return entity.inputEntity;
    } else if ("entity" in entity) {
      return getInputPeer(entity.entity);
    } else {
      _raiseCastFail(entity, "InputPeer");
    }
  }
  if (entity.SUBCLASS_OF_ID === 0xc91c90b6) {
    // crc32(b'InputPeer')
    return entity;
  }

  if (entity instanceof Api.User) {
    if (entity.self && allowSelf) {
      return new Api.InputPeerSelf();
    } else if (
      (entity.accessHash !== undefined && !entity.min) ||
      !checkHash
    ) {
      return new Api.InputPeerUser({
        userId: entity.id,
        accessHash: entity.accessHash || bigInt(0),
      });
    } else {
      throw new Error("User without accessHash or min cannot be input");
    }
  }
  if (
    entity instanceof Api.Chat ||
    entity instanceof Api.ChatEmpty ||
    entity instanceof Api.ChatForbidden
  ) {
    return new Api.InputPeerChat({ chatId: entity.id });
  }
  if (entity instanceof Api.Channel) {
    if ((entity.accessHash !== undefined && !entity.min) || !checkHash) {
      return new Api.InputPeerChannel({
        channelId: entity.id,
        accessHash: entity.accessHash || bigInt(0),
      });
    } else {
      throw new TypeError(
        "Channel without accessHash or min info cannot be input",
      );
    }
  }
  if (entity instanceof Api.ChannelForbidden) {
    // "channelForbidden are never min", and since their hash is
    // also not optional, we assume that this truly is the case.
    return new Api.InputPeerChannel({
      channelId: entity.id,
      accessHash: entity.accessHash,
    });
  }

  if (entity instanceof Api.InputUser) {
    return new Api.InputPeerUser({
      userId: entity.userId,
      accessHash: entity.accessHash,
    });
  }
  if (entity instanceof Api.InputChannel) {
    return new Api.InputPeerChannel({
      channelId: entity.channelId,
      accessHash: entity.accessHash,
    });
  }
  if (entity instanceof Api.UserEmpty) {
    return new Api.InputPeerEmpty();
  }
  if (entity instanceof Api.UserFull) {
    return getInputPeer(entity.id);
  }

  if (entity instanceof Api.ChatFull) {
    return new Api.InputPeerChat({ chatId: entity.id });
  }

  if (entity instanceof Api.PeerChat) {
    return new Api.InputPeerChat({
      chatId: entity.chatId,
    });
  }

  _raiseCastFail(entity, "InputPeer");
}

export function getPeer(peer: Api.TypeEntityLike | any) {
  if (!peer) _raiseCastFail(peer, "undefined");
  if (typeof peer === "string") _raiseCastFail(peer, "peer");
  if (typeof peer === "number" || typeof peer === "bigint") {
    peer = returnBigInt(peer);
  }
  try {
    if (bigInt.isInstance(peer)) {
      const res = resolveId(peer);
      if (res[1] === Api.PeerChannel) {
        return new Api.PeerChannel({ channelId: res[0] });
      } else if (res[1] === Api.PeerChat) {
        return new Api.PeerChat({ chatId: res[0] });
      } else {
        return new Api.PeerUser({ userId: res[0] });
      }
    }
    if (peer.SUBCLASS_OF_ID === undefined) {
      throw new Error();
    }
    if (peer.SUBCLASS_OF_ID === 0x2d45687) {
      // crc32('Peer')
      return peer;
    } else if (
      peer instanceof Api.contacts.ResolvedPeer ||
      peer instanceof Api.InputNotifyPeer ||
      peer instanceof Api.TopPeer ||
      peer instanceof Api.Dialog ||
      peer instanceof Api.DialogPeer
    ) {
      return peer.peer;
    } else if (peer instanceof Api.ChannelFull) {
      return new Api.PeerChannel({ channelId: peer.id });
    }
    if (
      peer.SUBCLASS_OF_ID === 0x7d7c6f86 ||
      peer.SUBCLASS_OF_ID === 0xd9c7fc18
    ) {
      // ChatParticipant, ChannelParticipant
      if ("userId" in peer) {
        return new Api.PeerUser({ userId: peer.userId });
      }
    }
    peer = getInputPeer(peer, false, false);
    if (peer instanceof Api.InputPeerUser) {
      return new Api.PeerUser({ userId: peer.userId });
    } else if (peer instanceof Api.InputPeerChat) {
      return new Api.PeerChat({ chatId: peer.chatId });
    } else if (peer instanceof Api.InputPeerChannel) {
      return new Api.PeerChannel({ channelId: peer.channelId });
    }
  } catch (_e) {
    //
  }
  _raiseCastFail(peer, "peer");
}

export function getPeerId(peer: Api.TypeEntityLike, addMark = true) {
  if (typeof peer === "string" && parseID(peer)) {
    peer = returnBigInt(peer);
  }
  // First we assert it's a Peer TLObject, or early return for integers
  if (bigInt.isInstance(peer)) {
    return addMark ? peer.toString() : resolveId(peer)[0].toString();
  }
  // Tell the user to use their client to resolve InputPeerSelf if we got one
  if (peer instanceof Api.InputPeerSelf) {
    _raiseCastFail(peer, "int (you might want to use client.get_peer_id)");
  }

  try {
    peer = getPeer(peer);
  } catch (_e) {
    _raiseCastFail(peer, "int");
  }
  if (peer instanceof Api.PeerUser) {
    return peer.userId.toString();
  } else if (peer instanceof Api.PeerChat) {
    // Check in case the user mixed things up to avoid blowing up
    peer.chatId = resolveId(returnBigInt(peer.chatId))[0];
    return addMark ? peer.chatId.negate().toString() : peer.chatId.toString();
  } else if (typeof peer === "object" && "channelId" in peer) {
    // if (peer instanceof Api.PeerChannel)
    // Check in case the user mixed things up to avoid blowing up
    peer.channelId = resolveId(returnBigInt(peer.channelId))[0];
    if (!addMark) {
      return peer.channelId.toString();
    }
    // Concat -100 through math tricks, .to_supergroup() on
    // Madeline IDs will be strictly positive -> log works.
    return "-100" + peer.channelId.toString();
  }
  _raiseCastFail(peer, "int");
}

export function getInputUser(entity: Api.TypeEntityLike): Api.TypeInputUser {
  if (
    typeof entity === "string" ||
    typeof entity === "number" ||
    typeof entity === "bigint" ||
    bigInt.isInstance(entity)
  ) {
    _raiseCastFail(entity, "InputUser");
  }

  if (entity.SUBCLASS_OF_ID === undefined) {
    _raiseCastFail(entity, "InputUser");
  }
  if (entity.SUBCLASS_OF_ID === 0xe669bf46) {
    // crc32(b'InputUser')
    return entity;
  }

  if (entity instanceof Api.User) {
    if (entity.self) {
      return new Api.InputUserSelf();
    } else {
      return new Api.InputUser({
        userId: entity.id,
        accessHash: entity.accessHash || bigInt.zero,
      });
    }
  }
  if (entity instanceof Api.InputPeerSelf) {
    return new Api.InputUserSelf();
  }
  if (
    entity instanceof Api.UserEmpty ||
    entity instanceof Api.InputPeerEmpty
  ) {
    return new Api.InputUserEmpty();
  }
  if (entity instanceof Api.UserFull) {
    return getInputUser(entity);
  }

  if (entity instanceof Api.InputPeerUser) {
    return new Api.InputUser({
      userId: entity.userId,
      accessHash: entity.accessHash,
    });
  }
  if (entity instanceof Api.InputPeerUserFromMessage) {
    return new Api.InputUserFromMessage({
      userId: entity.userId,
      peer: entity.peer,
      msgId: entity.msgId,
    });
  }
  _raiseCastFail(entity, "InputUser");
}

export function _photoSizeByteCount(size: Api.TypePhotoSize) {
  if (size instanceof Api.PhotoSize) return size.size;
  if (size instanceof Api.PhotoStrippedSize) {
    if (size.bytes.length < 3 || size.bytes[0] != 1) {
      return size.bytes.length;
    }
    return size.bytes.length + 622;
  }
  if (size instanceof Api.PhotoCachedSize) return size.bytes.length;
  if (size instanceof Api.PhotoSizeEmpty) return 0;
  return undefined;
}

export function getDisplayName(entity: Api.TypeEntityLike) {
  if (entity instanceof Api.User) {
    if (entity.lastName && entity.firstName) {
      return `${entity.firstName} ${entity.lastName}`;
    } else if (entity.firstName) {
      return entity.firstName;
    } else if (entity.lastName) {
      return entity.lastName;
    } else {
      return "";
    }
  } else if (entity instanceof Api.Chat || entity instanceof Api.Channel) {
    return entity.title;
  }
  return "";
}

export function resolveInviteLink(_link: string): [number, number, number] {
  throw new Error("not implemented");
}

export function getMessageId(
  message: number | Api.TypeMessage | Api.TypeMessageIDLike | undefined,
): number | undefined {
  if (!message) {
    return;
  } else if (typeof message === "number") {
    return message;
  } else if (message.SUBCLASS_OF_ID === 0x790009e3 || "id" in message) {
    // crc32(b'Message')
    return message.id;
  } else {
    throw new Error(`Invalid message type: ${message.constructor.name}`);
  }
}

export function sanitizeParseMode(
  mode: string | ParseInterface,
): ParseInterface {
  if (mode === "md" || mode === "markdown") {
    return MarkdownParser;
  }
  if (mode === "html") {
    return HTMLParser;
  }
  if (typeof mode === "object") {
    if ("parse" in mode && "unparse" in mode) {
      return mode;
    }
  }
  throw new Error(`Invalid parse mode type ${mode}`);
}

export function getAppropriatedPartSize(fileSize: bigInt.BigInteger) {
  if (fileSize.lesser(104857600)) return 128; // 100MB
  if (fileSize.lesser(786432000)) return 256; // 750MB
  return 512;
}

export function getFileInfo(
  fileLocation:
    | Api.Message
    | Api.MessageMediaDocument
    | Api.MessageMediaPhoto
    | Api.TypeInputFileLocation,
): {
  dcId?: number;
  location: Api.TypeInputFileLocation;
  size?: bigInt.BigInteger;
} {
  if (!fileLocation || !fileLocation.SUBCLASS_OF_ID) {
    _raiseCastFail(fileLocation, "InputFileLocation");
  }
  if (fileLocation.SUBCLASS_OF_ID === 354669666) {
    return {
      dcId: undefined,
      location: fileLocation,
      size: undefined,
    };
  }
  let location;
  if (fileLocation instanceof Api.Message) {
    location = fileLocation.media;
  }
  if (fileLocation instanceof Api.MessageMediaDocument) {
    location = fileLocation.document;
  } else if (fileLocation instanceof Api.MessageMediaPhoto) {
    location = fileLocation.photo;
  }

  if (location instanceof Api.Document) {
    return {
      dcId: location.dcId,
      location: new Api.InputDocumentFileLocation({
        id: location.id,
        accessHash: location.accessHash,
        fileReference: location.fileReference,
        thumbSize: "",
      }),
      size: location.size,
    };
  } else if (location instanceof Api.Photo) {
    return {
      dcId: location.dcId,
      location: new Api.InputPhotoFileLocation({
        id: location.id,
        accessHash: location.accessHash,
        fileReference: location.fileReference,
        thumbSize: location.sizes[location.sizes.length - 1].type,
      }),
      size: bigInt(
        _photoSizeByteCount(location.sizes[location.sizes.length - 1]) || 0,
      ),
    };
  }
  _raiseCastFail(fileLocation, "InputFileLocation");
}

export function* chunks<T>(arr: T[], size = 100): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}

export function getInnerText(text: string, entities: Api.TypeMessageEntity[]) {
  const result: string[] = [];
  entities.forEach(function (value, _key) {
    const start = value.offset;
    const end = value.offset + value.length;
    result.push(text.slice(start, end));
  });
  return result;
}

export function getInputChannel(entity: Api.TypeEntityLike) {
  if (
    typeof entity === "string" ||
    typeof entity === "number" ||
    typeof entity === "bigint" ||
    bigInt.isInstance(entity)
  ) {
    _raiseCastFail(entity, "InputChannel");
  }
  if (entity.SUBCLASS_OF_ID === undefined) {
    _raiseCastFail(entity, "InputChannel");
  }
  if (entity.SUBCLASS_OF_ID === 0x40f202fd) {
    // crc32(b'InputChannel')
    return entity;
  }
  if (
    entity instanceof Api.Channel ||
    entity instanceof Api.ChannelForbidden
  ) {
    return new Api.InputChannel({
      channelId: entity.id,
      accessHash: entity.accessHash || bigInt.zero,
    });
  }

  if (entity instanceof Api.InputPeerChannel) {
    return new Api.InputChannel({
      channelId: entity.channelId,
      accessHash: entity.accessHash,
    });
  }
  _raiseCastFail(entity, "InputChannel");
}

export function getInputMessage(message: any): Api.InputMessageID {
  if (typeof message === "number") {
    return new Api.InputMessageID({ id: message });
  }
  if (message === undefined || message.SUBCLASS_OF_ID === undefined) {
    _raiseCastFail(message, "InputMessage");
  }
  if (message.SUBCLASS_OF_ID === 0x54b6bcc5) {
    // crc32(b'InputMessage')
    return message;
  } else if (message.SUBCLASS_OF_ID === 0x790009e3) {
    // crc32(b'Message'):
    return new Api.InputMessageID({ id: message.id });
  }
  _raiseCastFail(message, "InputMessage");
}

export function getInputPhoto(photo: any): Api.TypeInputPhoto {
  if (photo.SUBCLASS_OF_ID === undefined) {
    _raiseCastFail(photo, "InputPhoto");
  }

  if (photo.SUBCLASS_OF_ID === 2221106144) {
    return photo;
  }

  if (photo instanceof Api.Message) {
    photo = photo.media;
  }
  if (
    photo instanceof Api.photos.Photo ||
    photo instanceof Api.MessageMediaPhoto
  ) {
    photo = photo.photo;
  }
  if (photo instanceof Api.Photo) {
    return new Api.InputPhoto({
      id: photo.id,
      accessHash: photo.accessHash,
      fileReference: photo.fileReference,
    });
  }
  if (photo instanceof Api.PhotoEmpty) {
    return new Api.InputPhotoEmpty();
  }
  if (photo instanceof Api.messages.ChatFull) {
    photo = photo.fullChat;
  }
  if (photo instanceof Api.ChannelFull) {
    return getInputPhoto(photo.chatPhoto);
  } else {
    if (photo instanceof Api.UserFull) {
      return getInputPhoto(photo.profilePhoto);
    } else {
      if (
        photo instanceof Api.Channel ||
        photo instanceof Api.Chat ||
        photo instanceof Api.User
      ) {
        return getInputPhoto(photo.photo);
      }
    }
  }
  if (
    photo instanceof Api.UserEmpty ||
    photo instanceof Api.ChatEmpty ||
    photo instanceof Api.ChatForbidden ||
    photo instanceof Api.ChannelForbidden
  ) {
    return new Api.InputPhotoEmpty();
  }
  _raiseCastFail(photo, "InputPhoto");
}

export function getInputChatPhoto(photo: any): Api.TypeInputChatPhoto {
  if (photo === undefined || photo.SUBCLASS_OF_ID === undefined) {
    _raiseCastFail(photo, "InputChatPhoto");
  }
  if (photo.SUBCLASS_OF_ID === 0xd4eb2d74) {
    //crc32(b'InputChatPhoto')
    return photo;
  } else if (photo.SUBCLASS_OF_ID === 0xe7655f1f) {
    // crc32(b'InputFile'):
    return new Api.InputChatUploadedPhoto({
      file: photo,
    });
  }
  photo = getInputPhoto(photo);
  if (photo instanceof Api.InputPhoto) {
    return new Api.InputChatPhoto({
      id: photo,
    });
  } else if (photo instanceof Api.InputPhotoEmpty) {
    return new Api.InputChatPhotoEmpty();
  }
  _raiseCastFail(photo, "InputChatPhoto");
}

export function getInputDocument(
  document: any,
): Api.InputDocument | Api.InputDocumentEmpty {
  if (document.SUBCLASS_OF_ID === undefined) {
    _raiseCastFail(document, "InputDocument");
  }
  if (document.SUBCLASS_OF_ID === 0xf33fdb68) {
    return document;
  }
  if (document instanceof Api.Document) {
    return new Api.InputDocument({
      id: document.id,
      accessHash: document.accessHash,
      fileReference: document.fileReference,
    });
  }
  if (document instanceof Api.DocumentEmpty) {
    return new Api.InputDocumentEmpty();
  }
  if (document instanceof Api.MessageMediaDocument) {
    return getInputDocument(document.document);
  }
  if (document instanceof Api.Message) {
    return getInputDocument(document.media);
  }
  _raiseCastFail(document, "InputDocument");
}

const JPEG_HEADER = Buffer.from(
  "ffd8ffe000104a46494600010100000100010000ffdb004300281c1e231e19282321232d2b28303c64413c37373c7b585d4964918099968f808c8aa0b4e6c3a0aadaad8a8cc8ffcbdaeef5ffffff9bc1fffffffaffe6fdfff8ffdb0043012b2d2d3c353c76414176f8a58ca5f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8ffc00011080000000003012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00",
  "hex",
);
const JPEG_FOOTER = Buffer.from("ffd9", "hex");

export function strippedPhotoToJpg(stripped: Buffer) {
  // Note: Changes here should update _stripped_real_length
  if (stripped.length < 3 || stripped[0] !== 1) {
    return stripped;
  }
  const header = Buffer.from(JPEG_HEADER);
  header[164] = stripped[1];
  header[166] = stripped[2];
  return Buffer.concat([header, stripped.slice(3), JPEG_FOOTER]);
}

interface GetAttributesParams {
  attributes?: any;
  mimeType?: string;
  forceDocument?: boolean;
  voiceNote?: boolean;
  videoNote?: boolean;
  supportsStreaming?: boolean;
  thumb?: any;
}

export function getExtension(media: any): string {
  // Photos are always compressed as .jpg by Telegram
  try {
    getInputPhoto(media);
    return ".jpg";
  } catch (_e) {
    //
  }
  if (
    media instanceof Api.UserProfilePhoto ||
    media instanceof Api.ChatPhoto
  ) {
    return ".jpg";
  }

  if (media instanceof Api.MessageMediaDocument) {
    media = media.document;
  }
  if (
    media instanceof Api.Document ||
    media instanceof Api.WebDocument ||
    media instanceof Api.WebDocumentNoProxy
  ) {
    if (media.mimeType === "application/octet-stream") {
      // Octet stream are just bytes, which have no default extension
      return "";
    } else {
      return mGetExtension(media.mimeType) || "";
    }
  }
  return "";
}

function _getExtension(file: any): string {
  if (typeof file === "string") {
    return "." + file.split(".").pop();
  } else if ("name" in file) {
    return _getExtension(file.name);
  } else {
    return getExtension(file);
  }
}

export function isAudio(file: any): boolean {
  const ext = _getExtension(file);
  if (!ext) {
    const metadata = _getMetadata(file);
    return (metadata.get("mimeType") || "").startsWith("audio/");
  } else {
    file = "a" + ext;
    return (getType(file) || "").startsWith("audio/");
  }
}

export function isImage(file: any): boolean {
  const ext = _getExtension(file).toLowerCase();
  return (
    ext.endsWith(".png") || ext.endsWith(".jpg") || ext.endsWith(".jpeg")
  );
}

function _getMetadata(_file: any): Map<string, string> {
  // TODO Return nothing for now until we find a better way
  return new Map<string, string>();
}

function isVideo(file: any): boolean {
  const ext = _getExtension(file);
  if (!ext) {
    const metadata = _getMetadata(file);
    if (metadata.has("mimeType")) {
      return metadata.get("mimeType")?.startsWith("video/") || false;
    } else {
      return false;
    }
  } else {
    file = "a" + ext;
    return (getType(file) || "").startsWith("video/");
  }
}

export interface GetInputMediaInterface {
  isPhoto?: boolean;
  attributes?: Api.TypeDocumentAttribute[];
  forceDocument?: boolean;
  voiceNote?: boolean;
  videoNote?: boolean;
  supportsStreaming?: boolean;
}

export function getInputGeo(geo: any): Api.TypeInputGeoPoint {
  if (geo === undefined || geo.SUBCLASS_OF_ID === undefined) {
    _raiseCastFail(geo, "InputGeoPoint");
  }
  if (geo.SUBCLASS_OF_ID === 0x430d225) {
    // crc32(b'InputGeoPoint'):
    return geo;
  }

  if (geo instanceof Api.GeoPoint) {
    return new Api.InputGeoPoint({ lat: geo.lat, long: geo.long });
  }
  if (geo instanceof Api.GeoPointEmpty) {
    return new Api.InputGeoPointEmpty();
  }
  if (geo instanceof Api.MessageMediaGeo) {
    return getInputGeo(geo.geo);
  }
  if (geo instanceof Api.Message) {
    return getInputGeo(geo.media);
  }
  _raiseCastFail(geo, "InputGeoPoint");
}

export function getAttributes(
  file: File | CustomFile | TypeInputFile | string,
  {
    attributes = null,
    mimeType = undefined,
    forceDocument = false,
    voiceNote = false,
    videoNote = false,
    supportsStreaming = false,
    thumb = null,
  }: GetAttributesParams,
) {
  const name: string = typeof file === "string" ? file : file.name || "unnamed";
  if (mimeType === undefined) {
    mimeType = getType(name) || "application/octet-stream";
  }
  const attrObj = new Map();
  attrObj.set(
    Api.DocumentAttributeFilename,
    new Api.DocumentAttributeFilename({
      fileName: name.split(/[\\/]/).pop() || "",
    }),
  );
  if (isAudio(file)) {
    const m = _getMetadata(file);
    attrObj.set(
      Api.DocumentAttributeAudio,
      new Api.DocumentAttributeAudio({
        voice: voiceNote,
        title: m.has("title") ? m.get("title") : undefined,
        performer: m.has("author") ? m.get("author") : undefined,
        duration: Number.parseInt(m.get("duration") ?? "0"),
      }),
    );
  }
  if (!forceDocument && isVideo(file)) {
    let doc;
    if (thumb) {
      const t_m = _getMetadata(thumb);
      const width = Number.parseInt(t_m?.get("width") || "1");
      const height = Number.parseInt(t_m?.get("height") || "1");
      doc = new Api.DocumentAttributeVideo({
        duration: 0,
        h: height,
        w: width,
        roundMessage: videoNote,
        supportsStreaming: supportsStreaming,
      });
    } else {
      const m = _getMetadata(file);
      doc = new Api.DocumentAttributeVideo({
        roundMessage: videoNote,
        w: Number.parseInt(m.get("width") ?? "1"),
        h: Number.parseInt(m.get("height") ?? "1"),
        duration: Number.parseInt(m.get("duration") ?? "0"),
        supportsStreaming: supportsStreaming,
      });
    }

    attrObj.set(Api.DocumentAttributeVideo, doc);
  }
  if (videoNote) {
    if (attrObj.has(Api.DocumentAttributeAudio)) {
      attrObj.get(Api.DocumentAttributeAudio).voice = true;
    } else {
      attrObj.set(
        Api.DocumentAttributeAudio,
        new Api.DocumentAttributeAudio({
          duration: 0,
          voice: true,
        }),
      );
    }
  }
  /* Now override the attributes if any. As we have a dict of
  {cls: instance}, we can override any class with the list
   of attributes provided by the user easily.
  */
  if (attributes) {
    for (const a of attributes) {
      attrObj.set(a.constructor, a);
    }
  }

  return {
    attrs: Array.from(attrObj.values()) as Api.TypeDocumentAttribute[],
    mimeType: mimeType,
  };
}

export function getInputMedia(
  media: any,
  {
    isPhoto = false,
    attributes = undefined,
    forceDocument = false,
    voiceNote = false,
    videoNote = false,
    supportsStreaming = false,
  }: GetInputMediaInterface = {},
): Api.TypeInputMedia {
  if (media.SUBCLASS_OF_ID === undefined) {
    _raiseCastFail(media, "InputMedia");
  }

  if (media.SUBCLASS_OF_ID === 0xfaf846f4) {
    // crc32(b'InputMedia')
    return media;
  } else {
    if (media.SUBCLASS_OF_ID === 2221106144) {
      // crc32(b'InputPhoto')
      return new Api.InputMediaPhoto({ id: media });
    } else {
      if (media.SUBCLASS_OF_ID === 4081048424) {
        // crc32(b'InputDocument')
        return new Api.InputMediaDocument({ id: media });
      }
    }
  }

  if (media instanceof Api.MessageMediaPhoto) {
    return new Api.InputMediaPhoto({
      id: getInputPhoto(media.photo),
      ttlSeconds: media.ttlSeconds,
    });
  }
  if (
    media instanceof Api.Photo ||
    media instanceof Api.photos.Photo ||
    media instanceof Api.PhotoEmpty
  ) {
    return new Api.InputMediaPhoto({ id: getInputPhoto(media) });
  }
  if (media instanceof Api.MessageMediaDocument) {
    return new Api.InputMediaDocument({
      id: getInputDocument(media.document),
      ttlSeconds: media.ttlSeconds,
    });
  }
  if (media instanceof Api.Document || media instanceof Api.DocumentEmpty) {
    return new Api.InputMediaDocument({ id: getInputDocument(media) });
  }
  if (media instanceof Api.InputFile || media instanceof Api.InputFileBig) {
    if (isPhoto) {
      return new Api.InputMediaUploadedPhoto({ file: media });
    } else {
      const { attrs, mimeType } = getAttributes(media, {
        attributes: attributes,
        forceDocument: forceDocument,
        voiceNote: voiceNote,
        videoNote: videoNote,
        supportsStreaming: supportsStreaming,
      });
      return new Api.InputMediaUploadedDocument({
        file: media,
        mimeType: mimeType,
        attributes: attrs,
        forceFile: forceDocument,
      });
    }
  }
  if (media instanceof Api.MessageMediaGame) {
    return new Api.InputMediaGame({
      id: new Api.InputGameID({
        id: media.game.id,
        accessHash: media.game.accessHash,
      }),
    });
  }
  if (media instanceof Api.MessageMediaContact) {
    return new Api.InputMediaContact({
      phoneNumber: media.phoneNumber,
      firstName: media.firstName,
      lastName: media.lastName,
      vcard: "",
    });
  }
  if (media instanceof Api.MessageMediaGeo) {
    return new Api.InputMediaGeoPoint({ geoPoint: getInputGeo(media.geo) });
  }
  if (media instanceof Api.MessageMediaVenue) {
    return new Api.InputMediaVenue({
      geoPoint: getInputGeo(media.geo),
      title: media.title,
      address: media.address,
      provider: media.provider,
      venueId: media.venueId,
      venueType: "",
    });
  }
  if (media instanceof Api.MessageMediaDice) {
    return new Api.InputMediaDice({
      emoticon: media.emoticon,
    });
  }
  if (
    media instanceof Api.MessageMediaEmpty ||
    media instanceof Api.MessageMediaUnsupported ||
    media instanceof Api.ChatPhotoEmpty ||
    media instanceof Api.UserProfilePhotoEmpty ||
    media instanceof Api.ChatPhoto ||
    media instanceof Api.UserProfilePhoto
  ) {
    return new Api.InputMediaEmpty();
  }
  if (media instanceof Api.Message) {
    return getInputMedia(media.media, { isPhoto: isPhoto });
  }
  if (media instanceof Api.MessageMediaPoll) {
    let correctAnswers;
    if (media.poll.quiz) {
      if (!media.results.results) {
        throw new Error(
          "Cannot cast unanswered quiz to any kind of InputMedia.",
        );
      }

      correctAnswers = [];
      for (const r of media.results.results) {
        if (r.correct) {
          correctAnswers.push(r.option);
        }
      }
    } else {
      correctAnswers = undefined;
    }
    return new Api.InputMediaPoll({
      poll: media.poll,
      correctAnswers: correctAnswers,
      solution: media.results.solution,
      solutionEntities: media.results.solutionEntities,
    });
  }
  if (media instanceof Api.Poll) {
    return new Api.InputMediaPoll({
      poll: media,
    });
  }
  _raiseCastFail(media, "InputMedia");
}
