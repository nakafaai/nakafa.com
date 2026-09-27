import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/confect/contentRelease/bucket";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import { Effect } from "effect";

type ArticleAppLocale = Docs["articleBuckets"]["appLocale"];
type BucketKind = "article" | "category";

/** Updates one non-empty bucket count in the same transaction as its route. */
export const adjustArticleBucket = Effect.fn(
  "contentRelease.adjustArticleBucket"
)(function* (
  slot: ModelSlot,
  appLocale: ArticleAppLocale,
  bucket: string,
  kind: BucketKind,
  delta: -1 | 1
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article sitemap bucket ${bucket} is invalid.`
    );
  }
  const existing = yield* database
    .table("articleBuckets")
    .get("by_slot_and_appLocale_and_bucket", slot, appLocale, bucket)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  const articleCount =
    (existing?.articleCount ?? 0) + (kind === "article" ? delta : 0);
  const categoryCount =
    (existing?.categoryCount ?? 0) + (kind === "category" ? delta : 0);
  if (articleCount < 0 || categoryCount < 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article sitemap bucket ${appLocale}/${bucket} underflowed.`
    );
  }
  if (articleCount + categoryCount > CONTENT_BUCKET_SIZE) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Article sitemap bucket ${appLocale}/${bucket} exceeds ${CONTENT_BUCKET_SIZE} routes.`
    );
  }
  if (articleCount === 0 && categoryCount === 0) {
    const empty = yield* Effect.fromNullishOr(existing).pipe(Effect.orDie);
    yield* writer.table("articleBuckets").delete(empty._id);
    return;
  }
  const row = {
    appLocale,
    articleCount,
    bucket,
    categoryCount,
    slot,
  };
  if (existing) {
    yield* writer
      .table("articleBuckets")
      .replace(existing._id, row)
      .pipe(Effect.orDie);
    return;
  }
  yield* writer.table("articleBuckets").insert(row).pipe(Effect.orDie);
});
