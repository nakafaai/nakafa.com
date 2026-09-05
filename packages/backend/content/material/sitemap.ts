import { loadMaterialOwner } from "@repo/backend/content/material/owner";
import { readMaterialPartition } from "@repo/backend/content/material/partition";
import { MaterialSource } from "@repo/backend/content/material/source";
import {
  CONTENT_BUCKET_LIMIT,
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Lists non-empty deterministic partitions for visible published materials. */
export const readMaterialBuckets = Effect.fn(
  "contentRelease.readMaterialBuckets"
)(function* (appLocale: Parameters<typeof readMaterialPartition>[0]) {
  const owner = yield* loadMaterialOwner(appLocale);
  if (!(owner.active && owner.managed && owner.slot)) {
    return {
      activeReleaseId: owner.active?.releaseId ?? null,
      buckets: [],
      managed: false,
      materialCount: 0,
    };
  }
  const activeReleaseId = owner.active.releaseId;
  const source = yield* MaterialSource;
  const rows = yield* source.buckets(
    owner.slot,
    appLocale,
    CONTENT_BUCKET_LIMIT + 1
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
  appLocale: Parameters<typeof readMaterialPartition>[0],
  bucket: string
) {
  const partition = yield* readMaterialPartition(appLocale, bucket);
  if (partition.kind !== "found") {
    return null;
  }
  return {
    routes: partition.materials.map(({ projection }) => ({
      lastModified:
        projection.metadata.dateModified ?? projection.metadata.datePublished,
      publicPath: projection.publicPath,
    })),
  };
});
