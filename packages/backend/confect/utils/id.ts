import { nanoid } from "nanoid";

/** Generate a short, unique NanoID. */
export function generateNanoId(length?: number) {
  return nanoid(length ?? 10);
}
