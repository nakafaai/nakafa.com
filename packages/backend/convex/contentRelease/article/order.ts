import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  articlePublicationCursor,
  decodePublicationCursor,
} from "@repo/backend/convex/contentRelease/article/cursor";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import schema from "@repo/backend/convex/schema";
import { encodeArticlePublicationCursor } from "@repo/contents/_types/publication";
import type { PaginationOptions } from "convex/server";
import { type QueryStream, stream } from "convex-helpers/server/stream";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type AppLocale = Doc<"articleCatalog">["appLocale"];
type ArticleRow = Doc<"articleCatalog">;

/** Builds the current publication stream for one localized category. */
function categoryPublicationStream(
  ctx: ReadCtx,
  slot: ModelSlot,
  appLocale: AppLocale,
  category: string
) {
  return stream(ctx.db, schema)
    .query("articleCatalog")
    .withIndex("by_slot_appLocale_category_datePublished_contentKey", (index) =>
      index
        .eq("slot", slot)
        .eq("appLocale", appLocale)
        .eq("category", category)
        .gte("datePublished", "")
    )
    .order("desc");
}

/** Paginates the current stream with one bounded lookahead scan. */
const paginatePublicationStream = Effect.fn(
  "contentRelease.paginatePublicationStream"
)(function* (
  publication: QueryStream<ArticleRow>,
  options: PaginationOptions & {
    maximumBytesRead: number;
    maximumRowsRead: number;
  }
) {
  const cursor = yield* decodePublicationCursor(options.cursor);
  const scanned = yield* Effect.promise(() =>
    publication.paginate({
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

/** Reads current articles in truthful newest-first order. */
export const readOrderedArticles = Effect.fn(
  "contentRelease.readOrderedArticles"
)(function* (
  ctx: ReadCtx,
  slot: ModelSlot,
  appLocale: AppLocale,
  category: string | null,
  limit: number
) {
  return yield* Effect.promise(() => {
    if (category === null) {
      return ctx.db
        .query("articleCatalog")
        .withIndex(
          "by_slot_and_appLocale_and_datePublished_and_contentKey",
          (index) =>
            index
              .eq("slot", slot)
              .eq("appLocale", appLocale)
              .gte("datePublished", "")
        )
        .order("desc")
        .take(limit);
    }

    return ctx.db
      .query("articleCatalog")
      .withIndex(
        "by_slot_appLocale_category_datePublished_contentKey",
        (index) =>
          index
            .eq("slot", slot)
            .eq("appLocale", appLocale)
            .eq("category", category)
            .gte("datePublished", "")
      )
      .order("desc")
      .take(limit);
  });
});

/** Paginates the current publication index through one stable cursor. */
export const paginateArticles = Effect.fn("contentRelease.paginateArticles")(
  function* (
    ctx: ReadCtx,
    slot: ModelSlot,
    appLocale: AppLocale,
    category: string,
    options: PaginationOptions & {
      maximumBytesRead: number;
      maximumRowsRead: number;
    }
  ) {
    const publication = categoryPublicationStream(
      ctx,
      slot,
      appLocale,
      category
    );
    return yield* paginatePublicationStream(publication, options);
  }
);
