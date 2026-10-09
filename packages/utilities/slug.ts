/** Converts display text into Nakafa's lowercase, hyphenated anchor form. */
export function toAnchorSlug(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-");
}

/** Removes every slash at the start and at the end of a slug: "/hello/world/" becomes "hello/world". */
export function cleanSlug(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, "");
}
