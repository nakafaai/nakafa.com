import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_LIMIT,
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { readMaterialPartition } from "@repo/backend/convex/contentRelease/material/partition";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { Effect } from "effect";

/** Lists non-empty deterministic partitions for visible published materials. */
export const readMaterialBuckets = Effect.fn(
  "contentRelease.readMaterialBuckets"
)(function* (
  ctx: QueryCtx,
  appLocale: Parameters<typeof readMaterialPartition>[1]
) {
  const owner = yield* loadMaterialOwner(ctx, appLocale);
  if (!(owner.active && owner.managed)) {
    return {
      activeReleaseId: owner.active?.releaseId ?? null,
      buckets: [],
      managed: false,
      materialCount: 0,
    };
  }
  const activeReleaseId = owner.active.releaseId;
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_appLocale_and_bucket", (index) =>
        index.eq("appLocale", appLocale)
      )
      .take(CONTENT_BUCKET_LIMIT + 1)
  );
  if (rows.length > CONTENT_BUCKET_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material discovery buckets for ${appLocale} exceed their fixed partition space.`
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
        `Material discovery bucket ${appLocale}/${row.bucket} has invalid counts.`
      );
    }
  }
  return {
    activeReleaseId,
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
  appLocale: Parameters<typeof readMaterialPartition>[1],
  bucket: string
) {
  const partition = yield* readMaterialPartition(ctx, appLocale, bucket);
  if (partition.kind !== "found") {
    return null;
  }
  return {
    routes: partition.materials.map(({ projection }) => {
      const dates = normalizePublicationDates(projection.metadata);
      return {
        date: dates.datePublished,
        lastModified: dates.dateModified ?? dates.datePublished,
        publicPath: projection.publicPath,
      };
    }),
  };
});
