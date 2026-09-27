import { nanoid } from "nanoid";

/** Generate a cryptographically secure random UUID. */
export function generateId() {
  return crypto.randomUUID();
}

/** Generate a short, unique NanoID. */
export function generateNanoId(length?: number) {
  return nanoid(length ?? 10);
}
