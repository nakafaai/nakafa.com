import "server-only";

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  type ArticlePageCursor,
  type PublishedArticleCategory,
  type PublishedArticlePage,
  readPublishedArticlePage,
  readPublishedCategories,
} from "@/lib/content/article/catalog";
import { applyContentCache } from "@/lib/content/cache";
import { PublishedProjectionError } from "@/lib/content/published/errors";

type CategoryMatch = (category: PublishedArticleCategory) => boolean;

const PublishedArticleCategoryGenerationSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  appLocale: ActiveAppLocaleCodeSchema,
});

/** One localized category with the generation observed during its catalog read. */
export type PublishedArticleCategoryModel = PublishedArticleCategory &
  typeof PublishedArticleCategoryGenerationSchema.Type;

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

    const category = Arr.findFirst(page.categories, matches);
    if (Option.isSome(category)) {
      return Option.some({
        ...category.value,
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
  const categories: PublishedArticleCategoryModel[] = yield* Effect.forEach(
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

  const match = Arr.findFirst(
    categories,
    (category) => category.appLocale === current.appLocale
  );
  if (Option.isNone(match)) {
    return yield* categoryError(current.appLocale);
  }
  const selected = match.value;
  if (
    selected.route !== current.route ||
    selected.title !== current.title ||
    selected.rendererDomain !== current.rendererDomain ||
    Arr.some(
      categories,
      (category) =>
        category.activeManifestHash !== selected.activeManifestHash ||
        category.activeReleaseId !== selected.activeReleaseId
    )
  ) {
    return yield* categoryError(current.appLocale);
  }

  return Arr.map(categories, (category) => ({
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

  const mismatched = Arr.some(
    page.articles,
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
    readPublishedArticleCategory(route, locale).pipe(
      Effect.withTracerTiming(false)
    )
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
    readPublishedCategoryAlternates(current).pipe(
      Effect.withTracerTiming(false)
    )
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
    readPublishedCategoryPage(current, cursor).pipe(
      Effect.withTracerTiming(false)
    )
  );
  applyContentCache("article");
  return page;
}
