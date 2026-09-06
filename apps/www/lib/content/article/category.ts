import "server-only";

import {
  ACTIVE_APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  type ArticlePageCursor,
  type PublishedArticleCategory,
  type PublishedArticlePage,
  type PublishedCategoryPage,
  readPublishedArticlePage,
  readPublishedCategories,
} from "@/lib/content/article/catalog";
import { applyContentCache } from "@/lib/content/cache";
import { PublishedProjectionError } from "@/lib/content/published/errors";

type CategoryMatch = (category: PublishedArticleCategory) => boolean;

/** One localized category with the generation observed during its catalog read. */
export interface PublishedArticleCategoryModel
  extends PublishedArticleCategory {
  readonly activeManifestHash: PublishedCategoryPage["activeManifestHash"];
  readonly activeReleaseId: PublishedCategoryPage["activeReleaseId"];
  readonly appLocale: Locale;
}

/** Maps an incomplete signed category catalog to its public failure contract. */
function categoryError(locale: Locale, route = "articles") {
  return new PublishedProjectionError({
    appLocale: AppLocaleSchema.make(locale),
    publicPath: route,
  });
}

/** Finds one category across a stable sequence of bounded catalog pages. */
const findPublishedCategory = Effect.fn("www.articles.findCategory")(function* (
  locale: Locale,
  matches: CategoryMatch
) {
  let cursor: ArticlePageCursor = {
    cursor: null,
    expectedManifestHash: null,
    expectedReleaseId: null,
  };

  while (true) {
    const page = yield* readPublishedCategories({ ...cursor, locale });
    if (page.stale) {
      return yield* categoryError(locale);
    }

    const category = page.categories.find(matches);
    if (category) {
      return Option.some({
        ...category,
        activeManifestHash: page.activeManifestHash,
        activeReleaseId: page.activeReleaseId,
        appLocale: locale,
      } satisfies PublishedArticleCategoryModel);
    }
    if (page.done) {
      return Option.none<PublishedArticleCategoryModel>();
    }
    if (page.nextCursor === null) {
      return yield* categoryError(locale);
    }

    cursor = {
      cursor: page.nextCursor,
      expectedManifestHash: page.activeManifestHash,
      expectedReleaseId: page.activeReleaseId,
    };
  }
});

/** Resolves one localized route segment to its stable article category. */
export const readPublishedArticleCategory = Effect.fn(
  "www.articles.readCategory"
)(function* (route: string, locale: Locale) {
  const routeSlug = yield* Schema.decodeEffect(ArticleRouteSlugSchema)(
    route
  ).pipe(Effect.mapError(() => categoryError(locale, `articles/${route}`)));

  return yield* findPublishedCategory(
    locale,
    (category) => category.route === routeSlug
  );
});

/** Resolves every active locale route for one stable article category. */
export const readPublishedCategoryAlternates = Effect.fn(
  "www.articles.readCategoryAlternates"
)(function* (current: PublishedArticleCategoryModel) {
  const categories = yield* Effect.forEach(
    ACTIVE_APP_LOCALE_CODES,
    (locale) =>
      findPublishedCategory(
        locale,
        (item) => item.category === current.category
      ).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(categoryError(locale)),
            onSome: Effect.succeed,
          })
        )
      ),
    { concurrency: ACTIVE_APP_LOCALE_CODES.length }
  );

  const selected = categories.find(
    (category) => category.appLocale === current.appLocale
  );
  if (
    !selected ||
    selected.route !== current.route ||
    selected.title !== current.title ||
    selected.rendererDomain !== current.rendererDomain ||
    categories.some(
      (category) =>
        category.activeManifestHash !== selected.activeManifestHash ||
        category.activeReleaseId !== selected.activeReleaseId
    )
  ) {
    return yield* categoryError(current.appLocale);
  }

  return categories.map((category) => ({
    appLocale: category.appLocale,
    publicPath: `articles/${category.route}`,
  }));
});

/** Reads a current category page and verifies its cached route identity. */
export const readPublishedCategoryPage = Effect.fn(
  "www.articles.readResolvedCategoryPage"
)(function* (
  current: PublishedArticleCategoryModel,
  cursor: ArticlePageCursor
) {
  const page = yield* readPublishedArticlePage({
    ...cursor,
    category: current.category,
    locale: current.appLocale,
  });
  if (page.stale) {
    return page;
  }

  const mismatched = page.articles.some(
    (article) =>
      article.category !== current.category ||
      article.categoryTitle !== current.title ||
      article.route.category !== current.route
  );
  if (mismatched) {
    return yield* categoryError(current.appLocale, `articles/${current.route}`);
  }

  return page satisfies PublishedArticlePage;
});

/** Checks whether one localized category route exists in the signed catalog. */
export const hasPublishedArticleCategory = Effect.fn(
  "www.articles.hasCategory"
)((route: string, locale: Locale) =>
  readPublishedArticleCategory(route, locale).pipe(Effect.map(Option.isSome))
);

/** Caches one localized category resolution under article release tags. */
export async function getPublishedArticleCategory(
  route: string,
  locale: Locale
) {
  "use cache";

  const category = await Effect.runPromise(
    readPublishedArticleCategory(route, locale)
  );
  applyContentCache("article");
  return Option.getOrNull(category);
}

/** Caches reciprocal localized category routes under article release tags. */
export async function getPublishedCategoryAlternates(
  current: PublishedArticleCategoryModel
) {
  "use cache";

  const alternates = await Effect.runPromise(
    readPublishedCategoryAlternates(current)
  );
  applyContentCache("article");
  return alternates;
}

/** Caches one route-bound category page under article release tags. */
export async function getPublishedCategoryPage(
  current: PublishedArticleCategoryModel,
  cursor: ArticlePageCursor
) {
  "use cache";

  const page = await Effect.runPromise(
    readPublishedCategoryPage(current, cursor)
  );
  applyContentCache("article");
  return page;
}
