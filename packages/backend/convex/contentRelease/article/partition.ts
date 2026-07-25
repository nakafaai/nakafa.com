import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  ARTICLE_BUCKET_SIZE,
  isArticleBucket,
} from "@repo/backend/convex/contentRelease/article/bucket";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import {
  verifyArticle,
  verifyCategory,
} from "@repo/backend/convex/contentRelease/article/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Loads and verifies one complete bounded article hash partition. */
export const readArticlePartition = Effect.fn(
  "contentRelease.readArticlePartition"
)(function* (
  ctx: QueryCtx,
  locale: Parameters<typeof loadArticleOwner>[1],
  bucket: string
) {
  if (!isArticleBucket(bucket)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      "Article partition must be three lowercase hexadecimal characters."
    );
  }

  const owner = yield* loadArticleOwner(ctx, locale);
  if (!(owner.managed && owner.active)) {
    return { kind: "unmanaged" as const };
  }

  const [count, articles, categories] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("articleBuckets")
        .withIndex("by_locale_and_bucket", (index) =>
          index.eq("locale", locale).eq("bucket", bucket)
        )
        .unique()
    ),
    Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_locale_and_bucket_and_publicPath", (index) =>
          index.eq("locale", locale).eq("bucket", bucket)
        )
        .take(ARTICLE_BUCKET_SIZE + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("articleCategories")
        .withIndex("by_locale_and_bucket_and_category", (index) =>
          index.eq("locale", locale).eq("bucket", bucket)
        )
        .take(ARTICLE_BUCKET_SIZE + 1)
    ),
  ]);
  if (!count) {
    return { kind: "missing" as const };
  }
  if (
    articles.length !== count.articleCount ||
    categories.length !== count.categoryCount ||
    articles.length + categories.length > ARTICLE_BUCKET_SIZE
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article partition ${locale}/${bucket} does not match its committed count.`
    );
  }

  const [verifiedArticles, verifiedCategories] = yield* Effect.all([
    Effect.forEach(articles, (article) =>
      verifyArticle(ctx, article, owner.active.sequence)
    ),
    Effect.forEach(categories, (category) =>
      verifyCategory(ctx, category, owner.active.sequence)
    ),
  ]);

  return {
    articles: verifiedArticles,
    categories: verifiedCategories,
    kind: "found" as const,
  };
});
