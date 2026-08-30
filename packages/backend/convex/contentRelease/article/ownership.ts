import {
  type ArticleRouteSlug,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { adjustArticleBucket } from "@repo/backend/convex/contentRelease/article/bucket";
import { ARTICLE_PREDECESSOR_LIMIT } from "@repo/backend/convex/contentRelease/article/limits";
import { readOrderedArticles } from "@repo/backend/convex/contentRelease/article/order";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import type { WithoutSystemFields } from "convex/server";
import { Effect, Schema } from "effect";

type AppLocale = Doc<"articleCatalog">["appLocale"];
type ArticleEntry = WithoutSystemFields<Doc<"articleCatalog">>;

export interface ArticleCategoryClaim {
  readonly appLocale: AppLocale;
  readonly category: ArticleEntry["category"];
  readonly rendererDomain: ArticleEntry["rendererDomain"];
  readonly route: ArticleRouteSlug;
  readonly title: ArticleEntry["categoryTitle"];
}

/** Page-scoped route ownership resolved once for one application locale. */
export interface ArticlePredecessorRoutes {
  readonly appLocale: AppLocale;
  readonly categoryRoutes: ReadonlyMap<
    ArticleEntry["category"],
    ArticleRouteSlug
  >;
  readonly routeCategories: ReadonlyMap<
    ArticleRouteSlug,
    readonly ArticleEntry["category"][]
  >;
}

/** Loads the sole active article row for one locale-specific content identity. */
export const loadArticle = Effect.fn("contentRelease.loadArticle")(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  contentKey: string,
  appLocale: AppLocale
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("articleCatalog")
      .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index
          .eq("slot", slot)
          .eq("contentKey", contentKey)
          .eq("appLocale", appLocale)
      )
      .unique()
  );
});

/** Loads the sole active localized row for one article category. */
const loadCategory = Effect.fn("contentRelease.loadArticleCategory")(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  appLocale: AppLocale,
  category: string
) {
  const categories = yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_slot_and_appLocale_and_category", (index) =>
        index
          .eq("slot", slot)
          .eq("appLocale", appLocale)
          .eq("category", category)
      )
      .take(2)
  );
  if (categories.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article category ${appLocale}/${category} has multiple active owners.`
    );
  }
  return categories[0] ?? null;
});

/** Loads at most two explicit category owners for one localized route. */
const loadCategoryRoutes = Effect.fn(
  "contentRelease.loadArticleCategoryRoutes"
)(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  appLocale: AppLocale,
  route: ArticleRouteSlug
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_slot_and_appLocale_and_route", (index) =>
        index.eq("slot", slot).eq("appLocale", appLocale).eq("route", route)
      )
      .take(2)
  );
});

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

/** Resolves one category route across current and page-scoped predecessor rows. */
const resolveCategoryRoute = Effect.fn(
  "contentRelease.resolveArticleCategoryRoute"
)(function* (
  category: Doc<"articleCategories">,
  predecessors: ArticlePredecessorRoutes
) {
  if (category.route !== undefined) {
    return yield* Schema.decodeEffect(ArticleRouteSlugSchema)(
      category.route
    ).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Article category ${category.appLocale}/${category.category} has an invalid stored route.`,
          })
      )
    );
  }
  if (predecessors.appLocale !== category.appLocale) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article category ${category.appLocale}/${category.category} received mismatched predecessor ownership.`
    );
  }
  const route = predecessors.categoryRoutes.get(category.category);
  if (route === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article category ${category.appLocale}/${category.category} lost its predecessor route.`
    );
  }
  return route;
});

/** Resolves every bounded predecessor route once for one application locale. */
export const loadPredecessorRoutes = Effect.fn(
  "contentRelease.loadArticlePredecessorRoutes"
)(function* (ctx: MutationCtx, slot: ModelSlot, appLocale: AppLocale) {
  const categories = yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_slot_and_appLocale_and_route", (index) =>
        index.eq("slot", slot).eq("appLocale", appLocale).eq("route", undefined)
      )
      .take(ARTICLE_PREDECESSOR_LIMIT + 1)
  );
  if (categories.length > ARTICLE_PREDECESSOR_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Article route verification accepts at most ${ARTICLE_PREDECESSOR_LIMIT} predecessor categories per locale.`
    );
  }
  const categoryRoutes = new Map<string, ArticleRouteSlug>();
  const routeCategories = new Map<ArticleRouteSlug, readonly string[]>();
  for (const category of categories) {
    if (categoryRoutes.has(category.category)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category ${appLocale}/${category.category} has multiple predecessor owners.`
      );
    }
    const representative = yield* loadArticle(
      ctx,
      slot,
      category.contentKey,
      category.appLocale
    );
    if (!representative) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article category ${category.appLocale}/${category.category} lost its predecessor representative.`
      );
    }
    const route = yield* decodeCategoryRoute(representative.publicPath);
    categoryRoutes.set(category.category, route);
    routeCategories.set(route, [
      ...(routeCategories.get(route) ?? []),
      category.category,
    ]);
  }
  return {
    appLocale,
    categoryRoutes,
    routeCategories,
  } satisfies ArticlePredecessorRoutes;
});

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
    slot: article.slot,
    title: article.categoryTitle,
  };
}

/** Stages one category identity before final release route validation. */
export const stageCategory = Effect.fn("contentRelease.stageArticleCategory")(
  function* (ctx: MutationCtx, article: ArticleEntry, route: ArticleRouteSlug) {
    const existing = yield* loadCategory(
      ctx,
      article.slot,
      article.appLocale,
      article.category
    );
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
          article.slot,
          existing.appLocale,
          existing.bucket,
          "category",
          -1
        );
        yield* adjustArticleBucket(
          ctx,
          article.slot,
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
    yield* adjustArticleBucket(
      ctx,
      article.slot,
      row.appLocale,
      row.bucket,
      "category",
      1
    );
    yield* Effect.promise(() => ctx.db.insert("articleCategories", row));
  }
);

/** Validates one effective article against a resolved localized claim. */
export const validateCategoryMember = Effect.fn(
  "contentRelease.validateArticleCategoryMember"
)(function* (article: ArticleEntry, claim: ArticleCategoryClaim) {
  const route = yield* decodeCategoryRoute(article.publicPath);
  if (claim.route !== route) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${article.contentKey}/${article.appLocale} conflicts with category route ${claim.route}.`
    );
  }
  if (claim.title !== article.categoryTitle) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${article.contentKey}/${article.appLocale} conflicts with category title ${claim.title}.`
    );
  }
  if (claim.rendererDomain !== article.rendererDomain) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${article.contentKey}/${article.appLocale} conflicts with category renderer ${claim.rendererDomain}.`
    );
  }
});

/** Resolves and validates one category claim from the effective final model. */
export const validateCategoryClaim = Effect.fn(
  "contentRelease.validateArticleCategoryClaim"
)(function* (
  ctx: MutationCtx,
  article: ArticleEntry,
  predecessors: ArticlePredecessorRoutes
) {
  if (predecessors.appLocale !== article.appLocale) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${article.contentKey}/${article.appLocale} received mismatched predecessor ownership.`
    );
  }
  const categoryOwner = yield* loadCategory(
    ctx,
    article.slot,
    article.appLocale,
    article.category
  );
  if (!categoryOwner) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article category ${article.appLocale}/${article.category} lost its final owner.`
    );
  }
  const route = yield* resolveCategoryRoute(categoryOwner, predecessors);
  const claim = {
    appLocale: categoryOwner.appLocale,
    category: categoryOwner.category,
    rendererDomain: categoryOwner.rendererDomain,
    route,
    title: categoryOwner.title,
  } satisfies ArticleCategoryClaim;
  yield* validateCategoryMember(article, claim);
  const routeOwners = yield* loadCategoryRoutes(
    ctx,
    article.slot,
    claim.appLocale,
    claim.route
  );
  const routeCategories = [
    ...routeOwners.map((owner) => owner.category),
    ...(predecessors.routeCategories.get(claim.route) ?? []),
  ];
  const conflictingOwner = routeCategories.find(
    (category) => category !== claim.category
  );
  if (routeCategories.length !== 1 || conflictingOwner) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article category route ${claim.appLocale}/${claim.route} conflicts with active category ${conflictingOwner ?? claim.category}.`
    );
  }
  return claim;
});

/** Rebuilds one category after its selected article moves or disappears. */
export const reconcileCategory = Effect.fn(
  "contentRelease.reconcileArticleCategory"
)(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  appLocale: AppLocale,
  category: string
) {
  const [representative] = yield* readOrderedArticles(
    ctx,
    slot,
    appLocale,
    category,
    1
  );
  if (representative) {
    const route = yield* decodeCategoryRoute(representative.publicPath);
    yield* stageCategory(ctx, representative, route);
    return;
  }
  const existing = yield* loadCategory(ctx, slot, appLocale, category);
  if (existing) {
    yield* adjustArticleBucket(
      ctx,
      slot,
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
