import "@tanstack/react-start/server-only";

import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { Array as Arr, Effect, MutableList, Option, Schema } from "effect";
import type { Locale } from "use-intl";
import {
  type ArticlePageCursor,
  type PublishedArticleCategory,
  type PublishedArticlePage,
  readPublishedArticlePage,
  readPublishedCategories,
} from "@/lib/content/article/catalog";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { readContentStore } from "@/lib/content/store/read";

type CategoryMatch = (category: PublishedArticleCategory) => boolean;

const PublishedArticleCategoryGenerationSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  appLocale: ActiveAppLocaleCodeSchema,
});

/** Every localized category of one release with the generation that it came from. */
const PublishedArticleCategoriesSchema = Schema.Struct({
  activeManifestHash: Sha256HashSchema,
  activeReleaseId: ReleaseIdSchema,
  categories: Schema.Array(
    Schema.Struct({
      category: ArticleCategorySchema,
      rendererDomain: RendererDomainSchema,
      route: ArticleRouteSlugSchema,
      title: ArticleCategoryTitleSchema,
    })
  ),
});

/** One localized category with the generation observed during its catalog read. */
type PublishedArticleCategoryModel = PublishedArticleCategory &
  typeof PublishedArticleCategoryGenerationSchema.Type;

/** Maps an incomplete signed category catalog to its public failure contract. */
function categoryError(locale: Locale, route = "articles") {
  return new PublishedProjectionError({
    appLocale: AppLocaleSchema.make(locale),
    publicPath: route,
  });
}

/** Walks every bounded page of the category catalog under one pinned generation. */
const walkPublishedCategories = Effect.fn("www.articles.walkCategories")(
  function* (locale: Locale) {
    const categories = MutableList.make<PublishedArticleCategory>();
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

      MutableList.appendAll(categories, page.categories);
      if (page.done) {
        return {
          activeManifestHash: page.activeManifestHash,
          activeReleaseId: page.activeReleaseId,
          categories: MutableList.toArray(categories),
        };
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
  }
);

/**
 * Reads every localized category of the active release, with the generation it
 * came from. The shells, the proxy and the category pages all read this one
 * list, which the content store holds once for each release and locale.
 */
export const readPublishedArticleCategories = Effect.fn(
  "www.articles.readCategories"
)((locale: Locale) =>
  readContentStore({
    kind: "article.categories",
    load: walkPublishedCategories(locale),
    parts: [locale],
    schema: PublishedArticleCategoriesSchema,
  })
);

/** Finds one category in the list of the active release. */
const findPublishedCategory = Effect.fn("www.articles.findCategory")(function* (
  locale: Locale,
  matches: CategoryMatch
) {
  const { activeManifestHash, activeReleaseId, categories } =
    yield* readPublishedArticleCategories(locale);
  return Option.map(
    Arr.findFirst(categories, matches),
    (category) =>
      ({
        ...category,
        activeManifestHash,
        activeReleaseId,
        appLocale: locale,
      }) satisfies PublishedArticleCategoryModel
  );
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

  const selected = Arr.findFirst(
    categories,
    (category) => category.appLocale === current.appLocale
  );
  if (
    Option.isNone(selected) ||
    selected.value.route !== current.route ||
    selected.value.title !== current.title ||
    selected.value.rendererDomain !== current.rendererDomain ||
    Arr.some(
      categories,
      (category) =>
        category.activeManifestHash !== selected.value.activeManifestHash ||
        category.activeReleaseId !== selected.value.activeReleaseId
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

/**
 * Caches one localized category resolution under article release tags. The `use
 * cache` boundary stays so that the category pages prerender and the article
 * tag still expires them; behind it the category list comes from the store.
 */
export async function getPublishedArticleCategory(
  route: string,
  locale: Locale
) {
  const category = await Effect.runPromise(
    readPublishedArticleCategory(route, locale)
  );
  return category;
}

/**
 * Reads the reciprocal localized category routes. The category lists come from
 * the store, and the key holds the category with the release it was read under,
 * so a release that the category list reports is a new key.
 */
export async function getPublishedCategoryAlternates(
  current: PublishedArticleCategoryModel
) {
  const alternates = await Effect.runPromise(
    readPublishedCategoryAlternates(current)
  );
  return alternates;
}

/**
 * Caches one route-bound category page under article release tags. The key
 * holds the category with the release it was read under, as above, so a new
 * release is a new key and the page is read from Convex once for each key
 * instead of once an hour.
 */
export async function getPublishedCategoryPage(
  current: PublishedArticleCategoryModel,
  cursor: ArticlePageCursor
) {
  const page = await Effect.runPromise(
    readPublishedCategoryPage(current, cursor)
  );
  return page;
}
