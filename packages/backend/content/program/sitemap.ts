import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { readProgramPartition } from "@repo/backend/content/program/partition";
import { ProgramSource } from "@repo/backend/content/program/source";
import {
  CONTENT_BUCKET_LIMIT,
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Lists non-empty curriculum sitemap partitions for one active snapshot. */
export const readProgramBuckets = Effect.fn(
  "contentRelease.readProgramBuckets"
)(function* (appLocale: Parameters<typeof loadProgramOwner>[0]) {
  const owner = yield* loadProgramOwner(appLocale);
  if (!(owner.managed && owner.selected)) {
    return { buckets: [], managed: false, routeCount: 0 };
  }
  const source = yield* ProgramSource;
  const rows = yield* source.buckets(
    owner.selected.snapshotId,
    appLocale,
    CONTENT_BUCKET_LIMIT + 1
  );
  if (rows.length > CONTENT_BUCKET_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program sitemap buckets for ${appLocale} exceed their fixed partition space.`
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
        `Program sitemap bucket ${appLocale}/${row.bucket} has invalid counts.`
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
  appLocale: Parameters<typeof loadProgramOwner>[0],
  bucket: string
) {
  const partition = yield* readProgramPartition(appLocale, bucket);
  if (partition.kind !== "found") {
    return null;
  }
  return {
    routes: partition.routes.map(({ publicPath }) => ({ publicPath })),
  };
});
