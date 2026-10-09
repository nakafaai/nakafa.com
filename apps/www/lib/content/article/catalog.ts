import type { Ref } from "@confect/core";
import { HttpClient } from "@confect/js";
import "server-only";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type ArticleCategory,
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  ArticleMetadataSchema,
  ArticleProjectionSchema,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/paging";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyContentCache } from "@/lib/content/cache";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { httpLayer } from "@/lib/convex/http";
/** Stable source root for immutable Aksara article links. */
export const ARTICLE_SOURCE_ROOT = "packages/corpus/articles";
type ArticlePageArgs = Ref.Args<typeof contentRelease.article.publications>;
type ArticlePageResult = Ref.Returns<
  typeof contentRelease.article.publications
>;
type ArticlePageItem = ArticlePageResult["result"]["page"][number];
type CategoryPageArgs = Ref.Args<typeof contentRelease.article.categories>;
type CategoryPageResult = Ref.Returns<typeof contentRelease.article.categories>;
type CategoryPageItem = CategoryPageResult["result"]["page"][number];
/** Active release identity required to continue one stable catalog read. */
const ArticlePageCursorSchema = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  expectedManifestHash: Schema.NullOr(Sha256HashSchema),
  expectedReleaseId: Schema.NullOr(ReleaseIdSchema),
});
export type ArticlePageCursor = typeof ArticlePageCursorSchema.Type;
/** One localized category title verified against the active article model. */
export type PublishedArticleCategory = Effect.Success<
  ReturnType<typeof decodeCategoryItem>
>;
/** One verified article card selected from the active Aksara release. */
const PublishedArticleSummarySchema = Schema.Struct({
  authors: ArticleMetadataSchema.fields.authors,
  category: ArticleCategorySchema,
  categoryTitle: ArticleCategoryTitleSchema,
  dateModified: ArticleMetadataSchema.fields.dateModified,
  datePublished: ArticleMetadataSchema.fields.datePublished,
  description: ArticleMetadataSchema.fields.description,
  official: Schema.Boolean,
  publicPath: ArticleProjectionSchema.fields.publicPath,
  route: Schema.Struct({
    category: ArticleRouteSlugSchema,
    slug: ArticleRouteSlugSchema,
  }),
  title: Schema.String,
});
export type PublishedArticleSummary = typeof PublishedArticleSummarySchema.Type;
/** One bounded active article page with immutable provenance. */
export type PublishedArticlePage = Effect.Success<
  ReturnType<typeof readPublishedArticlePage>
>;
/** One bounded active category page with immutable provenance. */
export type PublishedCategoryPage = Effect.Success<
  ReturnType<typeof readPublishedCategories>
>;
/** Maps one malformed catalog field to the public projection failure contract. */
function projectionError(locale: Locale, publicPath = "articles") {
  return new PublishedProjectionError({
    appLocale: AppLocaleSchema.make(locale),
    publicPath,
  });
}
/** Decodes the immutable generation identity shared by one catalog page. */
const decodeCatalogIdentity = Effect.fn("www.articles.decodeIdentity")(
  function* (
    locale: Locale,
    activeManifestHash: null | string,
    activeReleaseId: null | string,
    managed: boolean
  ) {
    if (!managed || activeManifestHash === null || activeReleaseId === null) {
      return yield* projectionError(locale);
    }
    const [manifestHash, releaseId] = yield* Effect.all([
      Schema.decodeEffect(Sha256HashSchema)(activeManifestHash),
      Schema.decodeEffect(ReleaseIdSchema)(activeReleaseId),
    ]).pipe(Effect.mapError(() => projectionError(locale)));
    return {
      manifestHash,
      releaseId,
    };
  }
);
const decodeProjectionJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Unknown)
);

/** Strictly decodes one backend-verified article catalog row. */
const decodeArticleItem = Effect.fn("www.articles.decodeItem")(function* (
  item: ArticlePageItem,
  locale: Locale
) {
  const input = yield* decodeProjectionJson(item.projectionJson).pipe(
    Effect.mapError(() => projectionError(locale))
  );
  const projection = yield* Schema.decodeUnknownEffect(ArticleProjectionSchema)(
    input,
    {
      onExcessProperty: "error",
    }
  ).pipe(Effect.mapError(() => projectionError(locale, item.publicPath)));
  if (
    item.family !== "article" ||
    item.appLocale !== locale ||
    projection.appLocale !== locale ||
    projection.contentKey !== item.contentKey ||
    projection.publicPath !== item.publicPath
  ) {
    return yield* projectionError(locale, item.publicPath);
  }
  const metadata = projection.metadata;
  return {
    authors: metadata.authors,
    category: projection.category,
    categoryTitle: projection.categoryTitle,
    ...(metadata.dateModified === undefined
      ? {}
      : {
          dateModified: metadata.dateModified,
        }),
    datePublished: metadata.datePublished,
    ...(metadata.description === undefined
      ? {}
      : {
          description: metadata.description,
        }),
    official: projection.official,
    publicPath: projection.publicPath,
    route: {
      category: projection.categoryRouteSlug,
      slug: projection.articleRouteSlug,
    },
    title: metadata.title,
  } satisfies PublishedArticleSummary;
});
/** Strictly decodes one backend-verified category catalog row. */
const decodeCategoryItem = Effect.fn("www.articles.decodeCategory")(function* (
  item: CategoryPageItem,
  locale: Locale
) {
  const [category, route, title] = yield* Effect.all([
    Schema.decodeEffect(ArticleCategorySchema)(item.category),
    Schema.decodeEffect(ArticleRouteSlugSchema)(item.route),
    Schema.decodeEffect(ArticleCategoryTitleSchema)(item.title),
  ]).pipe(Effect.mapError(() => projectionError(locale)));
  return {
    category,
    rendererDomain: item.rendererDomain,
    route,
    title,
  };
});
/** Reads and decodes one exact category's newest-first article page. */
export const readPublishedArticlePage = Effect.fn(
  "www.articles.readPublishedPage"
)(function* (
  input: ArticlePageCursor & {
    readonly category: ArticleCategory;
    readonly locale: Locale;
  }
) {
  const appLocale = AppLocaleSchema.make(input.locale);
  const args = {
    appLocale,
    category: input.category,
    expectedManifestHash: input.expectedManifestHash,
    expectedReleaseId: input.expectedReleaseId,
    paginationOpts: {
      cursor: input.cursor,
      numItems: PROJECTION_PAGE_LIMIT,
    },
  } satisfies ArticlePageArgs;
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.article.publications, args)
  ).pipe(Effect.provide(httpLayer()));
  const {
    activeManifestHash: rawManifestHash,
    activeReleaseId: rawReleaseId,
    managed,
    result: page,
    sourceRevision: rawSourceRevision,
    stale,
  } = result;
  const { manifestHash: activeManifestHash, releaseId: activeReleaseId } =
    yield* decodeCatalogIdentity(
      input.locale,
      rawManifestHash,
      rawReleaseId,
      managed
    );
  const articles = yield* Effect.forEach(page.page, (item) =>
    decodeArticleItem(item, input.locale)
  );
  const sourceRevision = yield* decodeSourceRevision(rawSourceRevision, {
    appLocale,
    publicPath: "articles",
  });
  const done = page.isDone;
  const nextCursor = done ? null : page.continueCursor;
  return {
    activeManifestHash,
    activeReleaseId,
    articles,
    done,
    nextCursor,
    sourceRevision,
    stale,
  };
});
/** Reads and decodes one localized article-category page. */
export const readPublishedCategories = Effect.fn(
  "www.articles.readPublishedCategories"
)(function* (
  input: ArticlePageCursor & {
    readonly locale: Locale;
  }
) {
  const appLocale = AppLocaleSchema.make(input.locale);
  const args = {
    appLocale,
    expectedManifestHash: input.expectedManifestHash,
    expectedReleaseId: input.expectedReleaseId,
    paginationOpts: {
      cursor: input.cursor,
      numItems: PROJECTION_PAGE_LIMIT,
    },
  } satisfies CategoryPageArgs;
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.article.categories, args)
  ).pipe(Effect.provide(httpLayer()));
  const {
    activeManifestHash: rawManifestHash,
    activeReleaseId: rawReleaseId,
    managed,
    result: page,
    sourceRevision: rawSourceRevision,
    stale,
  } = result;
  const { manifestHash: activeManifestHash, releaseId: activeReleaseId } =
    yield* decodeCatalogIdentity(
      input.locale,
      rawManifestHash,
      rawReleaseId,
      managed
    );
  const categories = yield* Effect.forEach(page.page, (item) =>
    decodeCategoryItem(item, input.locale)
  );
  const sourceRevision = yield* decodeSourceRevision(rawSourceRevision, {
    appLocale,
    publicPath: "articles",
  });
  const done = page.isDone;
  const nextCursor = done ? null : page.continueCursor;
  return {
    activeManifestHash,
    activeReleaseId,
    categories,
    done,
    nextCursor,
    sourceRevision,
    stale,
  };
});
/** Caches one bounded article page under exact article release tags. */
export async function getPublishedArticlePage(
  input: ArticlePageCursor & {
    readonly category: ArticleCategory;
    readonly locale: Locale;
  }
) {
  "use cache";

  const page = await Effect.runPromise(
    readPublishedArticlePage(input).pipe(Effect.withTracerTiming(false))
  );
  applyContentCache("article");
  return page;
}
/** Caches one bounded category page under exact article release tags. */
export async function getPublishedCategories(
  input: ArticlePageCursor & {
    readonly locale: Locale;
  }
) {
  "use cache";

  const page = await Effect.runPromise(
    readPublishedCategories(input).pipe(Effect.withTracerTiming(false))
  );
  applyContentCache("article");
  return page;
}
