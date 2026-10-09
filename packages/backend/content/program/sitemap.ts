import {
  CONTENT_BUCKET_LIMIT,
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/confect/contentRelease/bucket";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadProgramOwner } from "@repo/backend/content/program/owner";
import { readProgramPartition } from "@repo/backend/content/program/partition";
import { ProgramSource } from "@repo/backend/content/program/source";
import { Array as Arr, Effect } from "effect";

/** Lists non-empty curriculum sitemap partitions for one active snapshot. */
export const readProgramBuckets = Effect.fn(
  "contentRelease.readProgramBuckets"
)(function* (appLocale: Parameters<typeof loadProgramOwner>[0]) {
  const owner = yield* loadProgramOwner(appLocale);
  if (!(owner.managed && owner.selected)) {
    return {
      buckets: [],
      managed: false,
      routeCount: 0,
    };
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
    buckets: Arr.map(rows, ({ bucket }) => bucket),
    managed: true,
    routeCount: Arr.reduce(
      rows,
      0,
      (total, { routeCount }) => total + routeCount
    ),
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
    routes: Arr.map(partition.routes, ({ publicPath }) => ({
      publicPath,
    })),
  };
});
