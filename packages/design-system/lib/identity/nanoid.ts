import { nanoid } from "nanoid";

/** Generates a compact identifier with Nakafa's default length. */
export function generateNanoId(length = 10) {
  return nanoid(length);
}
