/**
 * The UTF-8 bytes of a text. A size bound counts bytes and not characters, so a
 * character that takes two or more bytes counts as such.
 */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
