/** Converts display text into Nakafa's lowercase, hyphenated anchor form. */
export function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "-");
}
