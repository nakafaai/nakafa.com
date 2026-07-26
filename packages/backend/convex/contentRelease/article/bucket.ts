import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

const HASH_PREFIX = "sha256:";
const BUCKET_LENGTH = 3;
const BUCKET_PATTERN = /^[a-f\d]{3}$/;
const MAXIMUM_HEAD_READS_PER_ROUTE = 6;

/** Maximum non-empty article sitemap buckets for one locale. */
export const ARTICLE_BUCKET_LIMIT = 16 ** BUCKET_LENGTH;

/**
 * Maximum routes whose catalog, head, route, and representative reads fit in
 * one Convex transaction while preserving four MiB of platform headroom.
 */
export const ARTICLE_BUCKET_SIZE = Math.floor(
  (TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM) /
    (MAXIMUM_HEAD_READS_PER_ROUTE * READ_MODEL_DOCUMENT_LIMIT)
);

type ArticleLocale = Doc<"articleBuckets">["locale"];
type BucketKind = "article" | "category";

/** Derives one stable sitemap partition from an authenticated projection hash. */
export function getArticleBucket(projectionHash: string) {
  if (!projectionHash.startsWith(HASH_PREFIX)) {
    return null;
  }

  const bucket = projectionHash.slice(
    HASH_PREFIX.length,
    HASH_PREFIX.length + BUCKET_LENGTH
  );

  return BUCKET_PATTERN.test(bucket) ? bucket : null;
}

/** Checks one externally supplied sitemap bucket before indexed lookup. */
export function isArticleBucket(bucket: string) {
  return BUCKET_PATTERN.test(bucket);
}

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
  if (!isArticleBucket(bucket)) {
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
  if (articleCount + categoryCount > ARTICLE_BUCKET_SIZE) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Article sitemap bucket ${locale}/${bucket} exceeds ${ARTICLE_BUCKET_SIZE} routes.`
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
