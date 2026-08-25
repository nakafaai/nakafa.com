import {
  type ArticleRouteSlug,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { adjustArticleBucket } from "@repo/backend/convex/contentRelease/article/bucket";
import { readOrderedArticles } from "@repo/backend/convex/contentRelease/article/order";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import type { WithoutSystemFields } from "convex/server";
import { Effect, Schema } from "effect";

type AppLocale = Doc<"articleCatalog">["appLocale"];
type ArticleEntry = WithoutSystemFields<Doc<"articleCatalog">>;

/** Loads the sole active article row for one locale-specific content identity. */
export const loadArticle = Effect.fn("contentRelease.loadArticle")(function* (
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

/** Loads the sole active category claiming one localized route. */
const loadCategoryRoute = Effect.fn("contentRelease.loadArticleCategoryRoute")(
  function* (ctx: MutationCtx, appLocale: AppLocale, route: ArticleRouteSlug) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("articleCategories")
        .withIndex("by_appLocale_and_route", (index) =>
          index.eq("appLocale", appLocale).eq("route", route)
        )
        .unique()
    );
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

/** Resolves route ownership for bounded predecessor rows without stored routes. */
const loadBridgeRoute = Effect.fn("contentRelease.loadBridgeArticleRoute")(
  function* (ctx: MutationCtx, appLocale: AppLocale, route: ArticleRouteSlug) {
    const categories = yield* Effect.promise(() =>
      ctx.db
        .query("articleCategories")
        .withIndex("by_appLocale_and_route", (index) =>
          index.eq("appLocale", appLocale).eq("route", undefined)
        )
        .take(CONTENT_BUCKET_SIZE + 1)
    );
    if (categories.length > CONTENT_BUCKET_SIZE) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Article route verification accepts at most ${CONTENT_BUCKET_SIZE} predecessor categories per locale.`
      );
    }
    for (const category of categories) {
      const representative = yield* loadArticle(
        ctx,
        category.contentKey,
        category.appLocale
      );
      if (!representative) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Article category ${category.appLocale}/${category.category} lost its predecessor representative.`
        );
      }
      const predecessorRoute = yield* decodeCategoryRoute(
        representative.publicPath
      );
      if (predecessorRoute === route) {
        return category;
      }
    }
    return null;
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

/** Claims one category identity while rejecting active route contradictions. */
export const writeCategory = Effect.fn("contentRelease.writeArticleCategory")(
  function* (ctx: MutationCtx, article: ArticleEntry, route: ArticleRouteSlug) {
    const existing = yield* loadCategory(
      ctx,
      article.appLocale,
      article.category
    );
    const [routeOwner, bridgeRouteOwner] = yield* Effect.all([
      loadCategoryRoute(ctx, article.appLocale, route),
      loadBridgeRoute(ctx, article.appLocale, route),
    ]);
    const conflictingOwner = [routeOwner, bridgeRouteOwner].find(
      (owner) => owner !== null && owner.category !== article.category
    );
    if (conflictingOwner) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category route ${article.appLocale}/${route} is already claimed by active category ${conflictingOwner.category}.`
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

/** Rebuilds one category after its selected article moves or disappears. */
export const reconcileCategory = Effect.fn(
  "contentRelease.reconcileArticleCategory"
)(function* (ctx: MutationCtx, appLocale: AppLocale, category: string) {
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
});
