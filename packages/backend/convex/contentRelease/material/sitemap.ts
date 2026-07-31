import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_LIMIT,
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readExactMaterialSnapshot } from "@repo/backend/convex/contentRelease/material/exact";
import { loadMaterialCatalogOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { readMaterialPartition } from "@repo/backend/convex/contentRelease/material/partition";
import { Effect } from "effect";

type ExactMaterialOwner = Effect.Effect.Success<
  ReturnType<typeof readExactMaterialSnapshot>
>["owners"][number];

/** Counts exact owners that displace rows in the source route inventory. */
const countSourceClaims = Effect.fn("contentRelease.countMaterialSourceClaims")(
  function* (ctx: QueryCtx, owners: readonly ExactMaterialOwner[]) {
    let count = 0;
    for (const owner of owners) {
      const rows = yield* Effect.promise(() =>
        ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_section_and_kind_and_sourcePath", (index) =>
            index
              .eq("locale", owner.locale)
              .eq("section", "material")
              .eq("kind", "curriculum-lesson")
              .eq("sourcePath", owner.contentKey)
          )
          .take(2)
      );
      if (rows.length > 1) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Source material ${owner.contentKey}/${owner.locale} has multiple route rows.`
        );
      }
      if (rows.length === 1) {
        count++;
      }
    }
    return count;
  }
);

/** Lists non-empty deterministic partitions for visible published materials. */
export const readMaterialBuckets = Effect.fn(
  "contentRelease.readMaterialBuckets"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof readMaterialPartition>[1]
) {
  const owner = yield* loadMaterialCatalogOwner(ctx);
  if (!(owner.active && owner.ready)) {
    return {
      activeReleaseId: owner.active?.releaseId ?? null,
      buckets: [],
      managed: false,
      materialCount: 0,
      sourceClaimCount: 0,
    };
  }
  const activeReleaseId = owner.active.releaseId;
  if (!owner.familyManaged) {
    const { materials: visible, owners } = yield* readExactMaterialSnapshot(
      ctx,
      owner.active,
      locale
    );
    return {
      activeReleaseId,
      buckets: Array.from(new Set(visible.map(({ row }) => row.bucket))).sort(),
      managed: false,
      materialCount: visible.length,
      sourceClaimCount: yield* countSourceClaims(ctx, owners),
    };
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
    activeReleaseId,
    buckets: rows.map(({ bucket }) => bucket),
    managed: owner.familyManaged,
    materialCount: rows.reduce((total, { count }) => total + count, 0),
    sourceClaimCount: 0,
  };
});

/** Reads one complete bounded material sitemap partition. */
export const readMaterialSitemap = Effect.fn(
  "contentRelease.readMaterialSitemap"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof readMaterialPartition>[1],
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
