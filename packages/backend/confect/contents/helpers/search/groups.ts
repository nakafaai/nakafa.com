import type { contentSearchDocumentValidator } from "@repo/backend/confect/contents/helpers/search/schema";
import type { Schema } from "effect";
/** Search document shape shared by source-owned and release-owned read models. */
export type ContentSearchDocument = Schema.Schema.Type<
  typeof contentSearchDocumentValidator
>;

/** Interleaves unique group items fairly up to one explicit global limit. */
export function interleaveSearchGroups<Item>(
  groups: readonly (readonly Item[])[],
  limit: number,
  identify: (item: Item) => string
) {
  if (limit <= 0) {
    return [];
  }
  const ranked: Item[] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(0, ...groups.map((documents) => documents.length));
  for (let index = 0; index < maxLength; index += 1) {
    for (const documents of groups) {
      const document = documents[index];
      if (!document) {
        continue;
      }
      const identity = identify(document);
      if (seen.has(identity)) {
        continue;
      }
      ranked.push(document);
      seen.add(identity);
      if (ranked.length >= limit) {
        return ranked;
      }
    }
  }
  return ranked;
}
