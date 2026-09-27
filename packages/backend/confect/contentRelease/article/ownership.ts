import {
  type ArticleRouteSlug,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { adjustArticleBucket } from "@repo/backend/confect/contentRelease/article/bucket";
import { readOrderedArticles } from "@repo/backend/confect/contentRelease/article/order";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import type { WithoutSystemFields } from "convex/server";
import { Effect, Schema } from "effect";

type AppLocale = Docs["articleCatalog"]["appLocale"];
type ArticleEntry = WithoutSystemFields<Docs["articleCatalog"]>;
export interface ArticleCategoryClaim {
  readonly appLocale: AppLocale;
  readonly category: ArticleEntry["category"];
  readonly rendererDomain: ArticleEntry["rendererDomain"];
  readonly route: ArticleRouteSlug;
  readonly title: ArticleEntry["categoryTitle"];
}

/** Loads the sole active article row for one locale-specific content identity. */
export const loadArticle = Effect.fn("contentRelease.loadArticle")(function* (
  slot: ModelSlot,
  contentKey: string,
  appLocale: AppLocale
) {
  const database = yield* DatabaseReader;
  const matches = yield* database
    .table("articleCatalog")
    .index("by_slot_and_contentKey_and_appLocale", (index) =>
      index
        .eq("slot", slot)
        .eq("contentKey", contentKey)
        .eq("appLocale", appLocale)
    )
    .take(2)
    .pipe(Effect.orDie);
  if (matches.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article ${appLocale}/${contentKey} has multiple active owners.`
    );
  }
  return matches[0] ?? null;
});

/** Loads the sole active localized row for one article category. */
const loadCategory = Effect.fn("contentRelease.loadArticleCategory")(function* (
  slot: ModelSlot,
  appLocale: AppLocale,
  category: string
) {
  const database = yield* DatabaseReader;
  const categories = yield* database
    .table("articleCategories")
    .index("by_slot_and_appLocale_and_category", (index) =>
      index.eq("slot", slot).eq("appLocale", appLocale).eq("category", category)
    )
    .take(2)
    .pipe(Effect.orDie);
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
)(function* (slot: ModelSlot, appLocale: AppLocale, route: ArticleRouteSlug) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("articleCategories")
    .index("by_slot_and_appLocale_and_route", (index) =>
      index.eq("slot", slot).eq("appLocale", appLocale).eq("route", route)
    )
    .take(2)
    .pipe(Effect.orDie);
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
  function* (article: ArticleEntry, route: ArticleRouteSlug) {
    const writer = yield* DatabaseWriter;
    const existing = yield* loadCategory(
      article.slot,
      article.appLocale,
      article.category
    );
    if (
      existing?.sequence === article.sequence &&
      (existing.title !== article.categoryTitle ||
        existing.rendererDomain !== article.rendererDomain ||
        existing.route !== route)
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
          article.slot,
          existing.appLocale,
          existing.bucket,
          "category",
          -1
        );
        yield* adjustArticleBucket(
          article.slot,
          row.appLocale,
          row.bucket,
          "category",
          1
        );
      }
      yield* writer
        .table("articleCategories")
        .replace(existing._id, row)
        .pipe(Effect.orDie);
      return;
    }
    yield* adjustArticleBucket(
      article.slot,
      row.appLocale,
      row.bucket,
      "category",
      1
    );
    yield* writer.table("articleCategories").insert(row).pipe(Effect.orDie);
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
)(function* (article: ArticleEntry) {
  const categoryOwner = yield* loadCategory(
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
  const route = yield* Schema.decodeEffect(ArticleRouteSlugSchema)(
    categoryOwner.route
  ).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Article category ${categoryOwner.appLocale}/${categoryOwner.category} has an invalid stored route.`,
        })
    )
  );
  const claim = {
    appLocale: categoryOwner.appLocale,
    category: categoryOwner.category,
    rendererDomain: categoryOwner.rendererDomain,
    route,
    title: categoryOwner.title,
  } satisfies ArticleCategoryClaim;
  yield* validateCategoryMember(article, claim);
  const routeOwners = yield* loadCategoryRoutes(
    article.slot,
    claim.appLocale,
    claim.route
  );
  const conflictingOwner = routeOwners.find(
    (owner) => owner.category !== claim.category
  );
  if (conflictingOwner) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article category route ${claim.appLocale}/${claim.route} conflicts with active category ${conflictingOwner.category}.`
    );
  }
  return claim;
});

/** Rebuilds one category after its selected article moves or disappears. */
export const reconcileCategory = Effect.fn(
  "contentRelease.reconcileArticleCategory"
)(function* (slot: ModelSlot, appLocale: AppLocale, category: string) {
  const writer = yield* DatabaseWriter;
  const [representative] = yield* readOrderedArticles(
    slot,
    appLocale,
    category,
    1
  );
  if (representative) {
    const route = yield* decodeCategoryRoute(representative.publicPath);
    yield* stageCategory(representative, route);
    return;
  }
  const existing = yield* loadCategory(slot, appLocale, category);
  if (existing) {
    yield* adjustArticleBucket(
      slot,
      existing.appLocale,
      existing.bucket,
      "category",
      -1
    );
    yield* writer.table("articleCategories").delete(existing._id);
  }
});
