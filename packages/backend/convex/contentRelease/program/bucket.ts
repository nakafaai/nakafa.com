import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Records one sitemap route in its immutable program-snapshot partition. */
export const addProgramBucketRoute = Effect.fn(
  "contentRelease.addProgramBucketRoute"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  appLocale: Doc<"programBuckets">["appLocale"],
  bucket: string
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Program sitemap bucket ${bucket} is invalid.`
    );
  }
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("programBuckets")
      .withIndex("by_snapshotId_and_appLocale_and_bucket", (query) =>
        query
          .eq("snapshotId", snapshotId)
          .eq("appLocale", appLocale)
          .eq("bucket", bucket)
      )
      .unique()
  );
  const routeCount = (existing?.routeCount ?? 0) + 1;
  if (routeCount > CONTENT_BUCKET_SIZE) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Program sitemap bucket ${appLocale}/${bucket} exceeds ${CONTENT_BUCKET_SIZE} routes.`
    );
  }
  if (existing) {
    yield* Effect.promise(() =>
      ctx.db.patch("programBuckets", existing._id, { routeCount })
    );
    return;
  }
  yield* Effect.promise(() =>
    ctx.db.insert("programBuckets", {
      appLocale,
      bucket,
      index,
      routeCount,
      snapshotId,
    })
  );
});
