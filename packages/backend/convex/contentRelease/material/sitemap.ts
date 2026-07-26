import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_LIMIT,
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { readMaterialPartition } from "@repo/backend/convex/contentRelease/material/partition";
import { Effect } from "effect";

/** Lists non-empty deterministic partitions for managed materials. */
export const readMaterialBuckets = Effect.fn(
  "contentRelease.readMaterialBuckets"
)(function* (ctx: QueryCtx, locale: Parameters<typeof loadMaterialOwner>[1]) {
  const owner = yield* loadMaterialOwner(ctx, locale);
  if (!(owner.managed && owner.active)) {
    return { buckets: [], managed: false, materialCount: 0 };
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_locale_and_bucket", (index) => index.eq("locale", locale))
      .take(CONTENT_BUCKET_LIMIT + 1)
  );
  if (rows.length > CONTENT_BUCKET_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material discovery buckets for ${locale} exceed their fixed partition space.`
    );
  }
  for (const row of rows) {
    if (
      !isProjectionBucket(row.bucket) ||
      row.count < 1 ||
      row.count > CONTENT_BUCKET_SIZE
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material discovery bucket ${locale}/${row.bucket} has invalid counts.`
      );
    }
  }
  return {
    buckets: rows.map(({ bucket }) => bucket),
    managed: true,
    materialCount: rows.reduce((total, { count }) => total + count, 0),
  };
});

/** Reads one complete bounded material sitemap partition. */
export const readMaterialSitemap = Effect.fn(
  "contentRelease.readMaterialSitemap"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof loadMaterialOwner>[1],
  bucket: string
) {
  const partition = yield* readMaterialPartition(ctx, locale, bucket);
  if (partition.kind !== "found") {
    return null;
  }
  return {
    routes: partition.materials.map(({ projection }) => ({
      date: projection.metadata.date,
      publicPath: projection.publicPath,
    })),
  };
});
