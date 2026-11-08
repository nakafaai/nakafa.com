import type { Ref } from "@confect/core";
import "@tanstack/react-start/server-only";
import { PublicationDatesSchema } from "@nakafa/aksara-contracts/date";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Effect, Schema } from "effect";
import type { Locale } from "use-intl";
import type { PublishedArticleSummary } from "@/lib/content/article/catalog";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeContentRelease } from "@/lib/content/published/release";
import { queryPinnedContentStore } from "@/lib/content/store/query";

type DiscoveryItem = Ref.Returns<
  typeof contentRelease.article.latest
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
          : {
              dateModified: item.dateModified,
            }),
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
        : {
            description: item.description,
          }),
      official: item.official,
      publicPath,
      route: {
        category: routeCategory,
        slug: routeSlug,
      },
      title: item.title,
    } satisfies PublishedArticleSummary;
  }
);
/** Reads one complete published article partition for agent discovery. */
export const readPublishedArticleBucket = Effect.fn("www.articles.readBucket")(
  function* (locale: Locale, bucket: string, release?: ActiveContentReleaseId) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* queryPinnedContentStore(
      release,
      contentRelease.article.bucket,
      {
        appLocale,
        bucket,
      }
    );
    const activeReleaseId = yield* decodeContentRelease(
      result.activeReleaseId,
      {
        appLocale,
        publicPath: "articles",
      }
    );
    if (!result.managed || activeReleaseId === null) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "articles",
      });
    }
    if (result.articles === null) {
      return {
        activeReleaseId,
        articles: null,
      };
    }
    const articles = yield* Effect.forEach(result.articles, (article) =>
      decodeDiscoveryItem(article, locale)
    );
    return {
      activeReleaseId,
      articles,
    };
  }
);
/** Reads a bounded newest-first article set for feed discovery. */
export const readPublishedLatestArticles = Effect.fn("www.articles.readLatest")(
  function* (locale: Locale, limit: number, release?: ActiveContentReleaseId) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* queryPinnedContentStore(
      release,
      contentRelease.article.latest,
      {
        appLocale,
        limit,
      }
    );
    const activeReleaseId = yield* decodeContentRelease(
      result.activeReleaseId,
      {
        appLocale,
        publicPath: "articles",
      }
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
    return {
      activeReleaseId,
      articles,
    };
  }
);
/** Reads a bounded newest-first article set for one exact category. */
export const readPublishedCategoryArticles = Effect.fn(
  "www.articles.readCategory"
)(function* (
  locale: Locale,
  category: string,
  limit: number,
  release?: ActiveContentReleaseId
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* queryPinnedContentStore(
    release,
    contentRelease.article.listing,
    {
      appLocale,
      category,
      limit,
    }
  );
  const activeReleaseId = yield* decodeContentRelease(result.activeReleaseId, {
    appLocale,
    publicPath: `articles/${category}`,
  });
  if (!result.managed || activeReleaseId === null) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: `articles/${category}`,
    });
  }
  const articles = yield* Effect.forEach(result.articles, (article) =>
    decodeDiscoveryItem(article, locale)
  );
  return {
    activeReleaseId,
    articles,
  };
});
