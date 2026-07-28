import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

type ArticleLocale = Doc<"articleBuckets">["locale"];
type BucketKind = "article" | "category";

/** Updates one non-empty bucket count in the same transaction as its route. */
export const adjustArticleBucket = Effect.fn(
  "contentRelease.adjustArticleBucket"
)(function* (
  ctx: MutationCtx,
  locale: ArticleLocale,
  bucket: string,
  kind: BucketKind,
  delta: -1 | 1
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article sitemap bucket ${bucket} is invalid.`
    );
  }

  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("articleBuckets")
      .withIndex("by_locale_and_bucket", (index) =>
        index.eq("locale", locale).eq("bucket", bucket)
      )
      .unique()
  );
  const articleCount =
    (existing?.articleCount ?? 0) + (kind === "article" ? delta : 0);
  const categoryCount =
    (existing?.categoryCount ?? 0) + (kind === "category" ? delta : 0);

  if (articleCount < 0 || categoryCount < 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article sitemap bucket ${locale}/${bucket} underflowed.`
    );
  }
  if (articleCount + categoryCount > CONTENT_BUCKET_SIZE) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Article sitemap bucket ${locale}/${bucket} exceeds ${CONTENT_BUCKET_SIZE} routes.`
    );
  }

  if (articleCount === 0 && categoryCount === 0) {
    if (existing) {
      yield* Effect.promise(() =>
        ctx.db.delete("articleBuckets", existing._id)
      );
    }
    return;
  }

  const row = { articleCount, bucket, categoryCount, locale };
  if (existing) {
    yield* Effect.promise(() =>
      ctx.db.replace("articleBuckets", existing._id, row)
    );
    return;
  }

  yield* Effect.promise(() => ctx.db.insert("articleBuckets", row));
});
