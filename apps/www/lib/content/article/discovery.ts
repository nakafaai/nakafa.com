import "server-only";
import { PublicationDatesSchema } from "@nakafa/aksara-contracts/date";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import type { PublishedArticleSummary } from "@/lib/content/article/catalog";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

type DiscoveryItem = FunctionReturnType<
  typeof api.contentRelease.article.latest
>["articles"][number];
/** Decodes one backend-verified discovery row into the article card contract. */
const decodeDiscoveryItem = Effect.fn("www.articles.decodeDiscovery")(
  function* (item: DiscoveryItem, locale: Locale) {
    const appLocale = AppLocaleSchema.make(locale);
    const [
      category,
      categoryTitle,
      dates,
      publicPath,
      routeCategory,
      routeSlug,
    ] = yield* Effect.all([
      Schema.decodeEffect(ArticleCategorySchema)(item.category),
      Schema.decodeEffect(ArticleCategoryTitleSchema)(item.categoryTitle),
      Schema.decodeEffect(PublicationDatesSchema)({
        ...(item.dateModified === undefined
          ? {}
          : { dateModified: item.dateModified }),
        datePublished: item.datePublished,
      }),
      Schema.decodeEffect(PublicPathSchema)(item.publicPath),
      Schema.decodeEffect(ArticleRouteSlugSchema)(item.route.category),
      Schema.decodeEffect(ArticleRouteSlugSchema)(item.route.slug),
    ]).pipe(
      Effect.mapError(
        () =>
          new PublishedProjectionError({
            appLocale,
            publicPath: item.publicPath,
          })
      )
    );
    return {
      authors: item.authors,
      category,
      categoryTitle,
      ...dates,
      ...(item.description === undefined
        ? {}
        : { description: item.description }),
      official: item.official,
      publicPath,
      route: { category: routeCategory, slug: routeSlug },
      title: item.title,
    } satisfies PublishedArticleSummary;
  }
);
/** Reads one complete published article partition for agent discovery. */
export const readPublishedArticleBucket = Effect.fn("www.articles.readBucket")(
  function* (
    locale: Locale,
    bucket: string,
    expectedActiveReleaseId?: ContentReleasePin
  ) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* readRuntimeQuery(api.contentRelease.article.bucket, {
      appLocale,
      bucket,
    });
    const activeReleaseId = yield* decodeContentReleasePin(
      result.activeReleaseId,
      expectedActiveReleaseId,
      { appLocale, publicPath: "articles" }
    );
    if (!result.managed || activeReleaseId === null) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "articles",
      });
    }
    if (result.articles === null) {
      return { activeReleaseId, articles: null };
    }
    const articles = yield* Effect.forEach(result.articles, (article) =>
      decodeDiscoveryItem(article, locale)
    );
    return { activeReleaseId, articles };
  }
);
/** Reads a bounded newest-first article set for feed discovery. */
export const readPublishedLatestArticles = Effect.fn("www.articles.readLatest")(
  function* (
    locale: Locale,
    limit: number,
    expectedActiveReleaseId?: ContentReleasePin
  ) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* readRuntimeQuery(api.contentRelease.article.latest, {
      appLocale,
      limit,
    });
    const activeReleaseId = yield* decodeContentReleasePin(
      result.activeReleaseId,
      expectedActiveReleaseId,
      { appLocale, publicPath: "articles" }
    );
    if (!result.managed || activeReleaseId === null) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "articles",
      });
    }
    const articles = yield* Effect.forEach(result.articles, (article) =>
      decodeDiscoveryItem(article, locale)
    );
    return { activeReleaseId, articles };
  }
);
/** Reads a bounded newest-first article set for one exact category. */
export const readPublishedCategoryArticles = Effect.fn(
  "www.articles.readCategory"
)(function* (
  locale: Locale,
  category: string,
  limit: number,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(api.contentRelease.article.listing, {
    appLocale,
    category,
    limit,
  });
  const activeReleaseId = yield* decodeContentReleasePin(
    result.activeReleaseId,
    expectedActiveReleaseId,
    { appLocale, publicPath: `articles/${category}` }
  );
  if (!result.managed || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: `articles/${category}`,
    });
  }
  const articles = yield* Effect.forEach(result.articles, (article) =>
    decodeDiscoveryItem(article, locale)
  );
  return { activeReleaseId, articles };
});
