/** Normalizes comma-separated localized SEO keyword copy into keyword tokens. */
export function createSEOKeywords(source: string): string[] {
  return source
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}
