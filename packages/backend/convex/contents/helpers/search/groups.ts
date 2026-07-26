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

/** Interleaves groups fairly so one broad source cannot fill the page alone. */
export function interleaveSearchGroups(
  groups: readonly (readonly ContentSearchDocument[])[]
) {
  const ranked: ContentSearchDocument[] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(0, ...groups.map((documents) => documents.length));

  for (let index = 0; index < maxLength; index += 1) {
    for (const documents of groups) {
      const document = documents[index];

      if (!document || seen.has(document.content_id)) {
        continue;
      }

      ranked.push(document);
      seen.add(document.content_id);
    }
  }

  return ranked;
}
