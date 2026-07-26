import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  adjustArticleBucket,
  getArticleBucket,
} from "@repo/backend/convex/contentRelease/article/bucket";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type ContentHead = WithoutSystemFields<Doc<"contentHeads">>;
type ContentLocale = Doc<"articleCatalog">["locale"];
type ArticleEntry = WithoutSystemFields<Doc<"articleCatalog">>;

/** Loads the sole active article row for one locale-specific content identity. */
const loadArticle = Effect.fn("contentRelease.loadArticle")(function* (
  ctx: MutationCtx,
  contentKey: string,
  locale: ContentLocale
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("articleCatalog")
      .withIndex("by_contentKey_and_locale", (index) =>
        index.eq("contentKey", contentKey).eq("locale", locale)
      )
      .unique()
  );
});

/** Loads the sole active localized row for one article category. */
const loadCategory = Effect.fn("contentRelease.loadArticleCategory")(function* (
  ctx: MutationCtx,
  locale: ContentLocale,
  category: string
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_locale_and_category", (index) =>
        index.eq("locale", locale).eq("category", category)
      )
      .unique()
  );
});

/** Converts one active article into its category representative row. */
function categoryRow(article: ArticleEntry) {
  return {
    bucket: article.bucket,
    category: article.category,
    contentKey: article.contentKey,
    locale: article.locale,
    projectionHash: article.projectionHash,
    releaseId: article.releaseId,
    rendererDomain: article.rendererDomain,
    sequence: article.sequence,
    title: article.categoryTitle,
  };
}

/** Claims one category identity while rejecting contradictions in one release. */
const writeCategory = Effect.fn("contentRelease.writeArticleCategory")(
  function* (ctx: MutationCtx, article: ArticleEntry) {
    const existing = yield* loadCategory(ctx, article.locale, article.category);
    if (
      existing?.sequence === article.sequence &&
      (existing.title !== article.categoryTitle ||
        existing.rendererDomain !== article.rendererDomain)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category ${article.locale}/${article.category} conflicts within release ${article.releaseId}.`
      );
    }
    const row = categoryRow(article);
    yield* ensureDocumentSize(
      "Active article category",
      row,
      READ_MODEL_DOCUMENT_LIMIT
    );
    if (existing) {
      if (existing.bucket !== row.bucket) {
        yield* adjustArticleBucket(
          ctx,
          existing.locale,
          existing.bucket,
          "category",
          -1
        );
        yield* adjustArticleBucket(ctx, row.locale, row.bucket, "category", 1);
      }
      yield* Effect.promise(() =>
        ctx.db.replace("articleCategories", existing._id, row)
      );
      return;
    }
    yield* adjustArticleBucket(ctx, row.locale, row.bucket, "category", 1);
    yield* Effect.promise(() => ctx.db.insert("articleCategories", row));
  }
);

/** Rebuilds one category after its selected article moves or disappears. */
const reconcileCategory = Effect.fn("contentRelease.reconcileArticleCategory")(
  function* (ctx: MutationCtx, locale: ContentLocale, category: string) {
    const articles = yield* Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_locale_and_category_and_date_and_contentKey", (index) =>
          index.eq("locale", locale).eq("category", category)
        )
        .order("desc")
        .take(1)
    );
    const representative = articles[0];
    if (representative) {
      yield* writeCategory(ctx, representative);
      return;
    }
    const existing = yield* loadCategory(ctx, locale, category);
    if (existing) {
      yield* adjustArticleBucket(
        ctx,
        existing.locale,
        existing.bucket,
        "category",
        -1
      );
      yield* Effect.promise(() =>
        ctx.db.delete("articleCategories", existing._id)
      );
    }
  }
);

/** Replaces one active article row and reconciles its category ownership. */
export const writeArticle = Effect.fn("contentRelease.writeArticle")(function* (
  ctx: MutationCtx,
  head: ContentHead,
  projection: ArticleProjection
) {
  if (
    head.operation !== "upsert" ||
    head.delivery !== "public" ||
    head.family !== "article" ||
    !head.projectionHash ||
    !head.rendererDomain ||
    projection.contentKey !== head.contentKey ||
    projection.locale !== head.locale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article entry ${head.contentKey}/${head.locale} lost its public identity.`
    );
  }
  const bucket = getArticleBucket(head.projectionHash);
  if (!bucket) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article entry ${head.contentKey}/${head.locale} has an invalid projection hash.`
    );
  }
  const entry = {
    bucket,
    category: projection.category,
    categoryTitle: projection.categoryTitle,
    contentKey: head.contentKey,
    date: projection.metadata.date,
    locale: head.locale,
    projectionHash: head.projectionHash,
    publicPath: projection.publicPath,
    releaseId: head.releaseId,
    rendererDomain: head.rendererDomain,
    sequence: head.sequence,
  };
  yield* ensureDocumentSize(
    "Active article catalog entry",
    entry,
    READ_MODEL_DOCUMENT_LIMIT
  );
  const existing = yield* loadArticle(ctx, head.contentKey, head.locale);
  if (existing) {
    if (existing.bucket !== entry.bucket) {
      yield* adjustArticleBucket(
        ctx,
        existing.locale,
        existing.bucket,
        "article",
        -1
      );
      yield* adjustArticleBucket(ctx, entry.locale, entry.bucket, "article", 1);
    }
    yield* Effect.promise(() =>
      ctx.db.replace("articleCatalog", existing._id, entry)
    );
    if (existing.category !== entry.category) {
      yield* reconcileCategory(ctx, head.locale, existing.category);
    }
  } else {
    yield* adjustArticleBucket(ctx, entry.locale, entry.bucket, "article", 1);
    yield* Effect.promise(() => ctx.db.insert("articleCatalog", entry));
  }
  yield* writeCategory(ctx, entry);
});

/** Deletes one active article row and reconciles its former category. */
export const deleteArticle = Effect.fn("contentRelease.deleteArticle")(
  function* (ctx: MutationCtx, contentKey: string, locale: ContentLocale) {
    const existing = yield* loadArticle(ctx, contentKey, locale);
    if (!existing) {
      return;
    }
    yield* adjustArticleBucket(
      ctx,
      existing.locale,
      existing.bucket,
      "article",
      -1
    );
    yield* Effect.promise(() => ctx.db.delete("articleCatalog", existing._id));
    yield* reconcileCategory(ctx, locale, existing.category);
  }
);
