import { Api } from "./api.js";

export const EntityType_ = {
  USER: 0,
  CHAT: 1,
  CHANNEL: 2,
};

Object.freeze(EntityType_);

export function entityType_(entity: Api.TypeEntityLike) {
  if (typeof entity !== "object" || !("SUBCLASS_OF_ID" in entity)) {
    throw new Error(
      `${entity} is not a TLObject, cannot determine entity type`,
    );
  }
  if (
    ![
      0x2d45687, // crc32('Peer')
      0xc91c90b6, // crc32('InputPeer')
      0xe669bf46, // crc32('InputUser')
      0x40f202fd, // crc32('InputChannel')
      0x2da17977, // crc32('User')
      0xc5af5d94, // crc32('Chat')
      0x1f4661b9, // crc32('UserFull')
      0xd49a2697, // crc32('ChatFull')
    ].includes(entity.SUBCLASS_OF_ID)
  ) {
    throw new Error(`${entity} does not have any entity type`);
  }
  const name = entity.className;
  if (name.includes("User")) {
    return EntityType_.USER;
  } else if (name.includes("Chat")) {
    return EntityType_.CHAT;
  } else if (name.includes("Channel")) {
    return EntityType_.CHANNEL;
  } else if (name.includes("Self")) {
    return EntityType_.USER;
  }
  // 'Empty' in name or not found, we don't care, not a valid entity.
  throw new Error(`${entity} does not have any entity type`);
}
