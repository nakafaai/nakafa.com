import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Maximum catalog rows and discovery buckets accepted by this migration. */
export const MATERIAL_MIGRATION_LIMIT = 100;

/** One exact expected material discovery-bucket total. */
export interface MigrationBucketCount {
  readonly bucket: string;
  readonly count: number;
  readonly locale: Doc<"materialCatalog">["locale"];
}

/** Identifies one locale-specific material discovery bucket. */
function bucketKey(locale: Doc<"materialCatalog">["locale"], bucket: string) {
  return `${locale}:${bucket}`;
}

/** Adds one material row to its expected discovery-bucket total. */
export function countMaterialBucket(
  counts: Map<string, MigrationBucketCount>,
  locale: Doc<"materialCatalog">["locale"],
  bucket: string
) {
  const key = bucketKey(locale, bucket);
  const current = counts.get(key);
  counts.set(key, {
    bucket,
    count: (current?.count ?? 0) + 1,
    locale,
  });
}

/** Requires stored material bucket rows to equal their derived totals. */
export const verifyMaterialBuckets = Effect.fn(
  "contentRelease.verifyMaterialBuckets"
)(function* (
  ctx: MutationCtx,
  expected: ReadonlyMap<string, MigrationBucketCount>
) {
  const stored = yield* Effect.promise(() =>
    ctx.db.query("materialBuckets").take(MATERIAL_MIGRATION_LIMIT + 1)
  );
  if (stored.length > MATERIAL_MIGRATION_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material migration exceeds ${MATERIAL_MIGRATION_LIMIT} discovery buckets.`
    );
  }

  const remaining = new Map(expected);
  for (const row of stored) {
    const key = bucketKey(row.locale, row.bucket);
    const match = remaining.get(key);
    if (match?.count !== row.count) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material discovery bucket ${row.locale}/${row.bucket} has an invalid count.`
      );
    }
    remaining.delete(key);
  }
  if (remaining.size !== 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Material discovery bucket totals do not match the migrated catalog."
    );
  }
});
