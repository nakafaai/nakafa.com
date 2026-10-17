/** Truncate text for previews while preserving whole trimmed words where possible. */
export function truncateText({
  text,
  maxLength = 200,
}: {
  text: string;
  maxLength?: number;
}) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trim()}…`;
}

/**
 * The UTF-8 bytes of a text. A size bound counts bytes and not characters, so a
 * character that takes two or more bytes counts as such.
 */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
