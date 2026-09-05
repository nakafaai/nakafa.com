import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { ArticleSource } from "@repo/backend/content/article/source";
import {
  verifyArticle,
  verifyCategory,
} from "@repo/backend/content/article/verify";
import {
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Option } from "effect";

/** Loads and verifies one complete bounded article hash partition. */
export const readArticlePartition = Effect.fn(
  "contentRelease.readArticlePartition"
)(function* (
  appLocale: Parameters<typeof loadArticleOwner>[0],
  bucket: string
) {
  if (!isProjectionBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      "Article partition must be three lowercase hexadecimal characters."
    );
  }

  const owner = yield* loadArticleOwner(appLocale);
  const activeReleaseId = owner.active?.releaseId ?? null;
  if (!(owner.managed && owner.active && owner.slot)) {
    return { activeReleaseId, kind: "unmanaged" as const };
  }

  const source = yield* ArticleSource;
  const {
    count: selectedCount,
    articles,
    categories,
  } = yield* source.partition(
    owner.slot,
    appLocale,
    bucket,
    CONTENT_BUCKET_SIZE + 1
  );
  const count = Option.getOrNull(selectedCount);
  if (!count) {
    return { activeReleaseId, kind: "missing" as const };
  }
  if (
    articles.length !== count.articleCount ||
    categories.length !== count.categoryCount ||
    articles.length + categories.length > CONTENT_BUCKET_SIZE
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article partition ${appLocale}/${bucket} does not match its committed count.`
    );
  }

  const [verifiedArticles, verifiedCategories] = yield* Effect.all([
    Effect.forEach(articles, (article) =>
      verifyArticle(article, owner.active.sequence)
    ),
    Effect.forEach(categories, (category) =>
      verifyCategory(category, owner.active.sequence)
    ),
  ]);

  return {
    activeReleaseId,
    articles: verifiedArticles,
    categories: verifiedCategories,
    kind: "found" as const,
  };
});
