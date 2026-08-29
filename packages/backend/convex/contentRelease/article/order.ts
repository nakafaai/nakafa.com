import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  articlePublicationCursor,
  decodePublicationCursor,
} from "@repo/backend/convex/contentRelease/article/cursor";
import { readArticleDates } from "@repo/backend/convex/contentRelease/article/dates";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import schema from "@repo/backend/convex/schema";
import {
  comparePublicationDates,
  encodeArticlePublicationCursor,
} from "@repo/contents/_types/publication";
import type { PaginationOptions } from "convex/server";
import type { Value } from "convex/values";
import {
  type IndexBounds,
  type IndexKey,
  mergedStream,
  QueryStream,
  stream,
} from "convex-helpers/server/stream";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type AppLocale = Doc<"articleCatalog">["appLocale"];
type ArticleRow = Doc<"articleCatalog">;

const PUBLICATION_INDEX_FIELDS = [
  "appLocale",
  "category",
  "publicationDate",
  "contentKey",
  "_creationTime",
  "_id",
];

/** Gives legacy and current date indexes one truthful shared cursor key. */
class PublicationStream extends QueryStream<ArticleRow> {
  readonly #source: QueryStream<ArticleRow>;

  constructor(source: QueryStream<ArticleRow>) {
    super();
    this.#source = source;
  }

  getEqualityIndexFilter(): Value[] {
    return this.#source.getEqualityIndexFilter();
  }

  getIndexFields(): string[] {
    return [...PUBLICATION_INDEX_FIELDS];
  }

  getOrder() {
    return this.#source.getOrder();
  }

  iterWithKeys(
    trackBandwidth = false
  ): ReturnType<QueryStream<ArticleRow>["iterWithKeys"]> {
    const source = this.#source;

    return {
      async *[Symbol.asyncIterator](): AsyncGenerator<
        [ArticleRow | null, IndexKey, number],
        undefined
      > {
        for await (const [row, indexKey, bandwidth] of source.iterWithKeys(
          trackBandwidth
        )) {
          yield [row, indexKey, bandwidth];
        }
        return;
      },
    };
  }

  narrow(bounds: IndexBounds): QueryStream<ArticleRow> {
    return new PublicationStream(this.#source.narrow(bounds));
  }
}

/** Builds both transition-index streams for one localized category. */
function categoryPublicationStreams(
  ctx: ReadCtx,
  appLocale: AppLocale,
  category: string
) {
  const legacy = stream(ctx.db, schema)
    .query("articleCatalog")
    .withIndex("by_appLocale_and_category_and_date_and_contentKey", (index) =>
      index.eq("appLocale", appLocale).eq("category", category).gte("date", "")
    )
    .order("desc");
  const current = stream(ctx.db, schema)
    .query("articleCatalog")
    .withIndex(
      "by_appLocale_and_category_and_datePublished_and_contentKey",
      (index) =>
        index
          .eq("appLocale", appLocale)
          .eq("category", category)
          .gte("datePublished", "")
    )
    .order("desc");

  return [new PublicationStream(legacy), new PublicationStream(current)];
}

/** Paginates both streams with one bounded lookahead scan. */
const paginatePublicationStreams = Effect.fn(
  "contentRelease.paginatePublicationStreams"
)(function* (
  streams: PublicationStream[],
  options: PaginationOptions & {
    maximumBytesRead: number;
    maximumRowsRead: number;
  }
) {
  const seen = new Set<string>();
  const publications = mergedStream(streams, [
    ...PUBLICATION_INDEX_FIELDS,
  ]).filterWith((row) => {
    if (seen.has(row._id)) {
      return Promise.resolve(false);
    }
    seen.add(row._id);
    return Promise.resolve(true);
  });
  const cursor = yield* decodePublicationCursor(options.cursor);
  const scanned = yield* Effect.promise(() =>
    publications.paginate({
      ...options,
      cursor,
      maximumRowsRead: options.maximumRowsRead,
      numItems: options.numItems + 1,
    })
  );
  if (scanned.page.length <= options.numItems) {
    return {
      ...scanned,
      continueCursor: encodeArticlePublicationCursor(scanned.continueCursor),
      ...(scanned.splitCursor == null
        ? {}
        : {
            splitCursor: encodeArticlePublicationCursor(scanned.splitCursor),
          }),
    };
  }

  const page = scanned.page.slice(0, options.numItems);
  const last = page.at(-1);
  if (!last) {
    return yield* new ReleaseError({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Article publication lookahead lost its retained row.",
    });
  }
  return {
    ...scanned,
    continueCursor: articlePublicationCursor(last),
    isDone: false,
    page,
    ...(scanned.splitCursor == null
      ? {}
      : {
          splitCursor: encodeArticlePublicationCursor(scanned.splitCursor),
        }),
  };
});

/** Reads both transition indexes and restores one truthful order. */
export const readOrderedArticles = Effect.fn(
  "contentRelease.readOrderedArticles"
)(function* (
  ctx: ReadCtx,
  appLocale: AppLocale,
  category: string | null,
  limit: number
) {
  const [legacy, current] = yield* Effect.all([
    Effect.promise(() => {
      if (category === null) {
        return ctx.db
          .query("articleCatalog")
          .withIndex("by_appLocale_and_date_and_contentKey", (index) =>
            index.eq("appLocale", appLocale).gte("date", "")
          )
          .order("desc")
          .take(limit);
      }

      return ctx.db
        .query("articleCatalog")
        .withIndex(
          "by_appLocale_and_category_and_date_and_contentKey",
          (index) =>
            index
              .eq("appLocale", appLocale)
              .eq("category", category)
              .gte("date", "")
        )
        .order("desc")
        .take(limit);
    }),
    Effect.promise(() => {
      if (category === null) {
        return ctx.db
          .query("articleCatalog")
          .withIndex("by_appLocale_and_datePublished_and_contentKey", (index) =>
            index.eq("appLocale", appLocale).gte("datePublished", "")
          )
          .order("desc")
          .take(limit);
      }

      return ctx.db
        .query("articleCatalog")
        .withIndex(
          "by_appLocale_and_category_and_datePublished_and_contentKey",
          (index) =>
            index
              .eq("appLocale", appLocale)
              .eq("category", category)
              .gte("datePublished", "")
        )
        .order("desc")
        .take(limit);
    }),
  ]);

  const rows = [
    ...new Map([...legacy, ...current].map((row) => [row._id, row])).values(),
  ];
  yield* Effect.forEach(rows, readArticleDates);
  return rows.sort(comparePublicationDates).slice(0, limit);
});

/** Paginates both transition indexes through one stable cursor. */
export const paginateArticles = Effect.fn("contentRelease.paginateArticles")(
  function* (
    ctx: ReadCtx,
    appLocale: AppLocale,
    category: string,
    options: PaginationOptions & {
      maximumBytesRead: number;
      maximumRowsRead: number;
    }
  ) {
    const streams = categoryPublicationStreams(ctx, appLocale, category);
    return yield* paginatePublicationStreams(streams, options);
  }
);
