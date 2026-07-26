import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { Effect } from "effect";

/** Reads one complete verified material discovery partition. */
export const readMaterialPartition = Effect.fn(
  "contentRelease.readMaterialPartition"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof loadMaterialOwner>[1],
  bucket: string
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material discovery bucket ${bucket} is invalid.`
    );
  }
  const owner = yield* loadMaterialOwner(ctx, locale);
  if (!(owner.managed && owner.active)) {
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
  return {
    kind: "found" as const,
    materials: yield* Effect.forEach(rows, verifyMaterial),
  };
});
