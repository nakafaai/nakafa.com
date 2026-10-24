import { Array as Arr } from "effect";

/** Normalizes comma-separated localized SEO keyword copy into keyword tokens. */
export function createSEOKeywords(source: string): string[] {
  return Arr.filter(
    Arr.map(source.split(","), (keyword) => keyword.trim()),
    Boolean
  );
}
