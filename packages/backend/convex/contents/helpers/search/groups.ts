import type { contentSearchDocumentValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import type { Infer } from "convex/values";

/** Search document shape shared by source-owned and release-owned read models. */
export type ContentSearchDocument = Infer<
  typeof contentSearchDocumentValidator
>;

/** Merges ranked groups while preserving first-seen relevance order. */
export function appendSearchGroups(
  groups: readonly (readonly ContentSearchDocument[])[]
) {
  const ranked: ContentSearchDocument[] = [];
  const seen = new Set<string>();

  for (const documents of groups) {
    for (const document of documents) {
      if (seen.has(document.content_id)) {
        continue;
      }

      ranked.push(document);
      seen.add(document.content_id);
    }
  }

  return ranked;
}

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
