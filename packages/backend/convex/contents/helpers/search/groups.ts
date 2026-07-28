import type { contentSearchDocumentValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import type { Infer } from "convex/values";
import { Effect } from "effect";

/** Search document shape shared by source-owned and release-owned read models. */
export type ContentSearchDocument = Infer<
  typeof contentSearchDocumentValidator
>;

/** Distributes one read budget fairly across a fixed number of groups. */
export function allocateSearchLimits(total: number, groupCount: number) {
  if (total <= 0 || groupCount <= 0) {
    return [];
  }

  const base = Math.floor(total / groupCount);
  const remainder = total % groupCount;

  return Array.from(
    { length: groupCount },
    (_, index) => base + (index < remainder ? 1 : 0)
  );
}

/**
 * Reads groups with a fair first pass and one bounded refill pass.
 *
 * A saturated group is reread up to the global limit only when another group
 * leaves budget unused. This preserves common-case fairness without hiding
 * candidates behind an empty family or alternate query.
 */
export const readSearchGroups = Effect.fn("contents.search.readGroups")(
  function* <Group, Error, Requirements>(
    total: number,
    groups: readonly Group[],
    read: (
      group: Group,
      limit: number
    ) => Effect.Effect<readonly ContentSearchDocument[], Error, Requirements>
  ) {
    if (total <= 0 || groups.length === 0) {
      return [];
    }

    const limits = allocateSearchLimits(total, groups.length);
    const initial = yield* Effect.all(
      groups.map((group, index) => {
        const limit = limits[index] ?? 0;
        const documents =
          limit > 0
            ? read(group, limit)
            : Effect.succeed<readonly ContentSearchDocument[]>([]);

        return documents.pipe(
          Effect.map((result) => ({
            documents: result,
            group,
            index,
            limit,
          }))
        );
      }),
      { concurrency: "unbounded" }
    );
    const ranked = interleaveSearchGroups(
      initial.map(({ documents }) => documents)
    );

    if (ranked.length >= total) {
      return ranked.slice(0, total);
    }

    const saturated = initial.filter(({ documents, limit }) => {
      if (limit <= 0 || documents.length < limit || limit >= total) {
        return false;
      }

      return true;
    });

    if (saturated.length === 0) {
      return ranked;
    }

    const refills = yield* Effect.all(
      saturated.map(({ group, index }) =>
        read(group, total).pipe(
          Effect.map((documents) => ({ documents, index }))
        )
      ),
      { concurrency: "unbounded" }
    );
    const replacements = new Map<number, readonly ContentSearchDocument[]>();
    for (const { documents, index } of refills) {
      replacements.set(index, documents);
    }
    const refilled = initial.map(
      ({ documents, index }) => replacements.get(index) ?? documents
    );

    return interleaveSearchGroups(refilled).slice(0, total);
  }
);

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
