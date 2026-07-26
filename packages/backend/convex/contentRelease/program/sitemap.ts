import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_LIMIT,
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadProgramOwner } from "@repo/backend/convex/contentRelease/program/owner";
import { readProgramPartition } from "@repo/backend/convex/contentRelease/program/partition";
import { Effect } from "effect";

/** Lists non-empty curriculum sitemap partitions for one active snapshot. */
export const readProgramBuckets = Effect.fn(
  "contentRelease.readProgramBuckets"
)(function* (ctx: QueryCtx, locale: Parameters<typeof loadProgramOwner>[1]) {
  const owner = yield* loadProgramOwner(ctx, locale);
  if (!(owner.managed && owner.selected)) {
    return { buckets: [], managed: false, routeCount: 0 };
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("programBuckets")
      .withIndex("by_snapshotId_and_locale_and_bucket", (query) =>
        query.eq("snapshotId", owner.selected.snapshotId).eq("locale", locale)
      )
      .take(CONTENT_BUCKET_LIMIT + 1)
  );
  if (rows.length > CONTENT_BUCKET_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program sitemap buckets for ${locale} exceed their fixed partition space.`
    );
  }
  for (const row of rows) {
    if (
      !isProjectionBucket(row.bucket) ||
      row.routeCount < 1 ||
      row.routeCount > CONTENT_BUCKET_SIZE
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Program sitemap bucket ${locale}/${row.bucket} has invalid counts.`
      );
    }
  }
  return {
    buckets: rows.map(({ bucket }) => bucket),
    managed: true,
    routeCount: rows.reduce((total, { routeCount }) => total + routeCount, 0),
  };
});

/** Reads one complete curriculum sitemap partition. */
export const readProgramSitemap = Effect.fn(
  "contentRelease.readProgramSitemap"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof loadProgramOwner>[1],
  bucket: string
) {
  const partition = yield* readProgramPartition(ctx, locale, bucket);
  if (partition.kind !== "found") {
    return null;
  }
  return {
    routes: partition.routes.map(({ publicPath }) => ({ publicPath })),
  };
});
