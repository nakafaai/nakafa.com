import { photoOf, type UserPicture } from "@repo/backend/confect/users/picture";
import { Struct } from "effect";

/**
 * Patch one immutable user projection with some of its fields, and keep the
 * rest. Every optimistic update of an account row goes through it.
 */
export function patchUser<T extends object>(user: T, fields: Partial<T>): T {
  return { ...user, ...fields };
}

/**
 * The public copy of an account once it chooses a picture: the choice, and the
 * Google photo when that choice shows it, as the server sends them.
 */
export function publicPictureFields(
  account: { readonly image?: string | null | undefined },
  picture: typeof UserPicture.Type
) {
  const photo = photoOf({ image: account.image, picture });
  return { picture, ...(photo === undefined ? {} : { image: photo }) };
}

/**
 * The same user without a bio. The stored row holds no bio field at all when
 * the bio is empty, so the optimistic copy leaves the field out too.
 */
export function withoutBio<T extends { bio?: string }>(user: T) {
  return Struct.omit(user, ["bio"]);
}
