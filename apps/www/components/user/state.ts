import { Struct } from "effect";

/**
 * Patch one immutable user projection with some of its fields, and keep the
 * rest. Every optimistic update of an account row goes through it.
 */
export function patchUser<T extends object>(user: T, fields: Partial<T>): T {
  return { ...user, ...fields };
}

/**
 * The same user without a bio. The stored row holds no bio field at all when
 * the bio is empty, so the optimistic copy leaves the field out too.
 */
export function withoutBio<T extends { bio?: string }>(user: T) {
  return Struct.omit(user, ["bio"]);
}
