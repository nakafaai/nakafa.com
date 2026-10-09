/** Converts display text into Nakafa's lowercase, hyphenated anchor form. */
export function toAnchorSlug(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-");
}
