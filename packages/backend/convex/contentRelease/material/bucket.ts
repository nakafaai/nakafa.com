import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Updates one material discovery bucket in the route write transaction. */
export const adjustMaterialBucket = Effect.fn(
  "contentRelease.adjustMaterialBucket"
)(function* (
  ctx: MutationCtx,
  locale: Doc<"materialBuckets">["locale"],
  bucket: string,
  delta: -1 | 1
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material discovery bucket ${bucket} is invalid.`
    );
  }
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_locale_and_bucket", (index) =>
        index.eq("locale", locale).eq("bucket", bucket)
      )
      .unique()
  );
  const count = (existing?.count ?? 0) + delta;
  if (count < 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material discovery bucket ${locale}/${bucket} underflowed.`
    );
  }
  if (count > CONTENT_BUCKET_SIZE) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material discovery bucket ${locale}/${bucket} exceeds ${CONTENT_BUCKET_SIZE} routes.`
    );
  }
  if (count === 0) {
    if (existing) {
      yield* Effect.promise(() =>
        ctx.db.delete("materialBuckets", existing._id)
      );
    }
    return;
  }
  const row = { bucket, count, locale };
  if (existing) {
    yield* Effect.promise(() =>
      ctx.db.replace("materialBuckets", existing._id, row)
    );
    return;
  }
  yield* Effect.promise(() => ctx.db.insert("materialBuckets", row));
});
