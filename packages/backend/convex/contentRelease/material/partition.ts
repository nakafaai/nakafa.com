import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialCatalogOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { readVisibleMaterial } from "@repo/backend/convex/contentRelease/material/route";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { Effect } from "effect";

/** Reads one complete verified material discovery partition. */
export const readMaterialPartition = Effect.fn(
  "contentRelease.readMaterialPartition"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"materialCatalog">["locale"],
  bucket: string
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material discovery bucket ${bucket} is invalid.`
    );
  }
  const owner = yield* loadMaterialCatalogOwner(ctx);
  if (!(owner.active && owner.ready)) {
    return { kind: "unmanaged" as const };
  }
  const count = yield* Effect.promise(() =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_locale_and_bucket", (index) =>
        index.eq("locale", locale).eq("bucket", bucket)
      )
      .unique()
  );
  if (!count) {
    return { kind: "missing" as const };
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_locale_and_bucket_and_publicPath", (index) =>
        index.eq("locale", locale).eq("bucket", bucket)
      )
      .take(CONTENT_BUCKET_SIZE + 1)
  );
  if (
    rows.length !== count.count ||
    rows.length === 0 ||
    rows.length > CONTENT_BUCKET_SIZE
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material discovery bucket ${locale}/${bucket} has mismatched counts.`
    );
  }
  const materials = owner.familyManaged
    ? yield* Effect.forEach(rows, verifyMaterial)
    : (yield* Effect.forEach(rows, (row) =>
        readVisibleMaterial(ctx, row, false)
      )).filter((material) => material !== null);
  return materials.length === 0
    ? { kind: "missing" as const }
    : { kind: "found" as const, materials };
});
