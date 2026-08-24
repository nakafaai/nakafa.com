import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { comparePublicationDates } from "@repo/contents/_types/publication";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type AppLocale = Doc<"articleCatalog">["appLocale"];

/** Reads both disjoint transition indexes and restores one truthful order. */
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

  return [...legacy, ...current].sort(comparePublicationDates).slice(0, limit);
});

/** Paginates the single date index owned by the complete active generation. */
export const paginateArticles = Effect.fn("contentRelease.paginateArticles")(
  function* (
    ctx: ReadCtx,
    appLocale: AppLocale,
    category: string,
    options: PaginationOptions
  ) {
    const current = yield* Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex(
          "by_appLocale_and_category_and_datePublished_and_contentKey",
          (index) =>
            index
              .eq("appLocale", appLocale)
              .eq("category", category)
              .gte("datePublished", "")
        )
        .first()
    );

    if (current) {
      return yield* Effect.promise(() =>
        ctx.db
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
          .paginate(options)
      );
    }

    return yield* Effect.promise(() =>
      ctx.db
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
        .paginate(options)
    );
  }
);
