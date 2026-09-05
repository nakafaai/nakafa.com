import "server-only";
import {
  type GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type ArticleCategory,
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  type ArticleMetadata,
  ArticleProjectionSchema,
  type ArticleRouteSlug,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import {
  readArticlePage,
  readCategoryPage,
} from "@repo/backend/content/article/read";
import { api } from "@repo/backend/convex/_generated/api";
import { PROJECTION_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/paging";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyPublishedCatalogCache } from "@/lib/content/cache";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import { readRuntimeQuery } from "@/lib/content/runtime/query";
/** Stable source root for immutable Aksara article links. */
export const ARTICLE_SOURCE_ROOT = "packages/corpus/articles";
type ArticlePageArgs = FunctionArgs<
  typeof api.contentRelease.article.publications
>;
type ArticlePageResult = FunctionReturnType<
  typeof api.contentRelease.article.publications
>;
type ArticlePageItem = ArticlePageResult["result"]["page"][number];
type CategoryPageArgs = FunctionArgs<
  typeof api.contentRelease.article.categories
>;
type CategoryPageResult = FunctionReturnType<
  typeof api.contentRelease.article.categories
>;
type CategoryPageItem = CategoryPageResult["result"]["page"][number];
/** Active release identity required to continue one stable catalog read. */
export interface ArticlePageCursor {
  readonly cursor: null | string;
  readonly expectedManifestHash: null | typeof Sha256HashSchema.Type;
  readonly expectedReleaseId: null | typeof ReleaseIdSchema.Type;
}
/** One localized category title verified against the active article model. */
export interface PublishedArticleCategory {
  readonly category: ArticleCategory;
  readonly rendererDomain: CategoryPageItem["rendererDomain"];
  readonly route: ArticleRouteSlug;
  readonly title: typeof ArticleCategoryTitleSchema.Type;
}
/** One verified article card selected from the active Aksara release. */
export interface PublishedArticleSummary {
  readonly authors: (typeof ArticleProjectionSchema.Type)["metadata"]["authors"];
  readonly category: ArticleCategory;
  readonly categoryTitle: typeof ArticleCategoryTitleSchema.Type;
  readonly dateModified?: ArticleMetadata["dateModified"];
  readonly datePublished: ArticleMetadata["datePublished"];
  readonly description?: ArticleMetadata["description"];
  readonly official: boolean;
  readonly publicPath: (typeof ArticleProjectionSchema.Type)["publicPath"];
  readonly route: {
    readonly category: ArticleRouteSlug;
    readonly slug: ArticleRouteSlug;
  };
  readonly title: string;
}
/** One bounded active article page with immutable provenance. */
export interface PublishedArticlePage {
  readonly activeManifestHash: typeof Sha256HashSchema.Type;
  readonly activeReleaseId: typeof ReleaseIdSchema.Type;
  readonly articles: readonly PublishedArticleSummary[];
  readonly done: boolean;
  readonly nextCursor: null | string;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
  readonly stale: boolean;
}
/** One bounded active category page with immutable provenance. */
export interface PublishedCategoryPage {
  readonly activeManifestHash: typeof Sha256HashSchema.Type;
  readonly activeReleaseId: typeof ReleaseIdSchema.Type;
  readonly categories: readonly PublishedArticleCategory[];
  readonly done: boolean;
  readonly nextCursor: null | string;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
  readonly stale: boolean;
}
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
    return { manifestHash, releaseId };
  }
);
/** Strictly decodes one backend-verified article catalog row. */
const decodeArticleItem = Effect.fn("www.articles.decodeItem")(function* (
  item: ArticlePageItem,
  locale: Locale
) {
  const input = yield* Effect.try({
    catch: () => projectionError(locale),
    try: (): unknown => JSON.parse(item.projectionJson),
  });
  const projection = yield* Schema.decodeUnknownEffect(ArticleProjectionSchema)(
    input,
    { onExcessProperty: "error" }
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
      : { dateModified: metadata.dateModified }),
    datePublished: metadata.datePublished,
    ...(metadata.description === undefined
      ? {}
      : { description: metadata.description }),
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
  } satisfies PublishedArticleCategory;
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
  const result = yield* readRuntimeQuery(
    api.contentRelease.article.publications,
    args,
    (queryArgs) =>
      readArticlePage(
        queryArgs.category,
        queryArgs.appLocale,
        queryArgs.expectedManifestHash,
        queryArgs.expectedReleaseId,
        queryArgs.paginationOpts
      )
  );
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
  } satisfies PublishedArticlePage;
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
  const result = yield* readRuntimeQuery(
    api.contentRelease.article.categories,
    args,
    (queryArgs) =>
      readCategoryPage(
        queryArgs.appLocale,
        queryArgs.expectedManifestHash,
        queryArgs.expectedReleaseId,
        queryArgs.paginationOpts
      )
  );
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
  } satisfies PublishedCategoryPage;
});
/** Caches one bounded article page under exact article release tags. */
export async function getPublishedArticlePage(
  input: ArticlePageCursor & {
    readonly category: ArticleCategory;
    readonly locale: Locale;
  }
) {
  "use cache";
  const page = await Effect.runPromise(readPublishedArticlePage(input));
  applyPublishedCatalogCache("article");
  return page;
}
/** Caches one bounded category page under exact article release tags. */
export async function getPublishedCategories(
  input: ArticlePageCursor & {
    readonly locale: Locale;
  }
) {
  "use cache";
  const page = await Effect.runPromise(readPublishedCategories(input));
  applyPublishedCatalogCache("article");
  return page;
}
