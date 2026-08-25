import {
  type ArticleProjection,
  type ArticleRouteSlug,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { adjustArticleBucket } from "@repo/backend/convex/contentRelease/article/bucket";
import { readOrderedArticles } from "@repo/backend/convex/contentRelease/article/order";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import type { WithoutSystemFields } from "convex/server";
import { Effect, Schema } from "effect";

type ContentHead = WithoutSystemFields<Doc<"contentHeads">>;
type AppLocale = Doc<"articleCatalog">["appLocale"];
type ArticleEntry = WithoutSystemFields<Doc<"articleCatalog">>;

/** Loads the sole active article row for one locale-specific content identity. */
const loadArticle = Effect.fn("contentRelease.loadArticle")(function* (
  ctx: MutationCtx,
  contentKey: string,
  appLocale: AppLocale
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("articleCatalog")
      .withIndex("by_contentKey_and_appLocale", (index) =>
        index.eq("contentKey", contentKey).eq("appLocale", appLocale)
      )
      .unique()
  );
});

/** Loads the sole active localized row for one article category. */
const loadCategory = Effect.fn("contentRelease.loadArticleCategory")(function* (
  ctx: MutationCtx,
  appLocale: AppLocale,
  category: string
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_appLocale_and_category", (index) =>
        index.eq("appLocale", appLocale).eq("category", category)
      )
      .unique()
  );
});

/** Loads the sole category claiming one localized route in one release. */
const loadCategoryRoute = Effect.fn("contentRelease.loadArticleCategoryRoute")(
  function* (
    ctx: MutationCtx,
    appLocale: AppLocale,
    route: ArticleRouteSlug,
    sequence: number
  ) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("articleCategories")
        .withIndex("by_appLocale_and_route_and_sequence", (index) =>
          index
            .eq("appLocale", appLocale)
            .eq("route", route)
            .eq("sequence", sequence)
        )
        .unique()
    );
  }
);

/** Converts one active article into its category representative row. */
function categoryRow(article: ArticleEntry, route: ArticleRouteSlug) {
  return {
    appLocale: article.appLocale,
    bucket: article.bucket,
    category: article.category,
    contentKey: article.contentKey,
    projectionHash: article.projectionHash,
    releaseId: article.releaseId,
    rendererDomain: article.rendererDomain,
    route,
    sequence: article.sequence,
    title: article.categoryTitle,
  };
}

/** Claims one category identity while rejecting contradictions in one release. */
const writeCategory = Effect.fn("contentRelease.writeArticleCategory")(
  function* (ctx: MutationCtx, article: ArticleEntry, route: ArticleRouteSlug) {
    const existing = yield* loadCategory(
      ctx,
      article.appLocale,
      article.category
    );
    const routeOwner = yield* loadCategoryRoute(
      ctx,
      article.appLocale,
      route,
      article.sequence
    );
    if (routeOwner && routeOwner.category !== article.category) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category route ${article.appLocale}/${route} is already claimed by ${routeOwner.category} within release ${article.releaseId}.`
      );
    }
    if (
      existing?.sequence === article.sequence &&
      (existing.title !== article.categoryTitle ||
        existing.rendererDomain !== article.rendererDomain ||
        (existing.route !== undefined && existing.route !== route))
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category ${article.appLocale}/${article.category} conflicts within release ${article.releaseId}.`
      );
    }
    const row = categoryRow(article, route);
    yield* ensureDocumentSize(
      "Active article category",
      row,
      READ_MODEL_DOCUMENT_LIMIT
    );
    if (existing) {
      if (existing.bucket !== row.bucket) {
        yield* adjustArticleBucket(
          ctx,
          existing.appLocale,
          existing.bucket,
          "category",
          -1
        );
        yield* adjustArticleBucket(
          ctx,
          row.appLocale,
          row.bucket,
          "category",
          1
        );
      }
      yield* Effect.promise(() =>
        ctx.db.replace("articleCategories", existing._id, row)
      );
      return;
    }
    yield* adjustArticleBucket(ctx, row.appLocale, row.bucket, "category", 1);
    yield* Effect.promise(() => ctx.db.insert("articleCategories", row));
  }
);

/** Recovers one signed category route from an immutable article public path. */
const decodeCategoryRoute = Effect.fn("contentRelease.decodeCategoryRoute")(
  function* (publicPath: string) {
    const [root, category, article, ...remaining] = publicPath.split("/");
    if (root !== "articles" || article === undefined || remaining.length > 0) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article path ${publicPath} lost its category route.`
      );
    }
    return yield* Schema.decodeEffect(ArticleRouteSlugSchema)(category).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Article path ${publicPath} has an invalid category route.`,
          })
      )
    );
  }
);

/** Rebuilds one category after its selected article moves or disappears. */
const reconcileCategory = Effect.fn("contentRelease.reconcileArticleCategory")(
  function* (ctx: MutationCtx, appLocale: AppLocale, category: string) {
    const [representative] = yield* readOrderedArticles(
      ctx,
      appLocale,
      category,
      1
    );
    if (representative) {
      const route = yield* decodeCategoryRoute(representative.publicPath);
      yield* writeCategory(ctx, representative, route);
      return;
    }
    const existing = yield* loadCategory(ctx, appLocale, category);
    if (existing) {
      yield* adjustArticleBucket(
        ctx,
        existing.appLocale,
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
    projection.artifactLocale !== head.artifactLocale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article entry ${head.contentKey}/${head.artifactLocale} lost its public identity.`
    );
  }
  const bucket = getHashBucket(head.projectionHash);
  if (!bucket) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article entry ${head.contentKey}/${head.artifactLocale} has an invalid projection hash.`
    );
  }
  const dates = normalizePublicationDates(projection.metadata);
  const entry = {
    appLocale: projection.appLocale,
    assetId: projection.graph.assetId,
    bucket,
    category: projection.category,
    categoryTitle: projection.categoryTitle,
    contentKey: head.contentKey,
    ...dates,
    date: dates.datePublished,
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
  const existing = yield* loadArticle(
    ctx,
    head.contentKey,
    projection.appLocale
  );
  if (existing) {
    if (existing.bucket !== entry.bucket) {
      yield* adjustArticleBucket(
        ctx,
        existing.appLocale,
        existing.bucket,
        "article",
        -1
      );
      yield* adjustArticleBucket(
        ctx,
        entry.appLocale,
        entry.bucket,
        "article",
        1
      );
    }
    yield* Effect.promise(() =>
      ctx.db.replace("articleCatalog", existing._id, entry)
    );
    if (existing.category !== entry.category) {
      yield* reconcileCategory(ctx, projection.appLocale, existing.category);
    }
  } else {
    yield* adjustArticleBucket(
      ctx,
      entry.appLocale,
      entry.bucket,
      "article",
      1
    );
    yield* Effect.promise(() => ctx.db.insert("articleCatalog", entry));
  }
  yield* writeCategory(ctx, entry, projection.categoryRouteSlug);
});

/** Deletes one active article row and reconciles its former category. */
export const deleteArticle = Effect.fn("contentRelease.deleteArticle")(
  function* (ctx: MutationCtx, contentKey: string, appLocale: AppLocale) {
    const existing = yield* loadArticle(ctx, contentKey, appLocale);
    if (!existing) {
      return;
    }
    yield* adjustArticleBucket(
      ctx,
      existing.appLocale,
      existing.bucket,
      "article",
      -1
    );
    yield* Effect.promise(() => ctx.db.delete("articleCatalog", existing._id));
    yield* reconcileCategory(ctx, appLocale, existing.category);
  }
);
