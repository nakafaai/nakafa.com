import {
  categoryPosition,
  decodeCategoryPosition,
  isCategoryPosition,
} from "@repo/backend/content/article/category-cursor";
import { ArticleSource } from "@repo/backend/content/article/source";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  paginateArticles,
  readOrderedArticles,
} from "@repo/backend/convex/contentRelease/article/order";
import { Effect, Layer, Option } from "effect";

/** Preserves native article indexes and every deployed publication cursor. */
export const convexArticleLayer = (ctx: QueryCtx) =>
  Layer.merge(
    convexPublicationLayer(ctx),
    Layer.succeed(ArticleSource, {
      article: Effect.fn("article.convex.identity")(
        (slot, contentKey, appLocale) =>
          Effect.promise(() =>
            ctx.db
              .query("articleCatalog")
              .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
                index
                  .eq("slot", slot)
                  .eq("contentKey", contentKey)
                  .eq("appLocale", appLocale)
              )
              .unique()
          ).pipe(Effect.map(Option.fromNullishOr))
      ),
      byPublicPath: Effect.fn("article.convex.byPublicPath")(
        (slot, appLocale, publicPath) =>
          Effect.promise(() =>
            ctx.db
              .query("articleCatalog")
              .withIndex("by_slot_and_appLocale_and_publicPath", (index) =>
                index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale)
                  .eq("publicPath", publicPath)
              )
              .take(2)
          )
      ),
      byAssetId: Effect.fn("article.convex.byAssetId")(
        (slot, appLocale, assetId) =>
          Effect.promise(() =>
            ctx.db
              .query("articleCatalog")
              .withIndex("by_slot_and_appLocale_and_assetId", (index) =>
                index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale)
                  .eq("assetId", assetId)
              )
              .take(2)
          )
      ),
      ordered: Effect.fn("article.convex.ordered")(
        (slot, appLocale, category, limit) =>
          readOrderedArticles(ctx, slot, appLocale, category, limit)
      ),
      publications: Effect.fn("article.convex.publications")(
        (slot, appLocale, category, options) =>
          paginateArticles(ctx, slot, appLocale, category, options)
      ),
      categories: Effect.fn("article.convex.categories")(
        function* (slot, appLocale, options) {
          if (options.cursor !== null && !isCategoryPosition(options.cursor)) {
            return yield* Effect.promise(() =>
              ctx.db
                .query("articleCategories")
                .withIndex("by_slot_and_appLocale_and_category", (index) =>
                  index.eq("slot", slot).eq("appLocale", appLocale)
                )
                .paginate(options)
            );
          }
          const position = yield* decodeCategoryPosition(
            options.cursor,
            slot,
            appLocale
          );
          const stored = yield* Effect.promise(() =>
            ctx.db
              .query("articleCategories")
              .withIndex("by_slot_and_appLocale_and_category", (index) => {
                const scoped = index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale);
                return position === null
                  ? scoped
                  : scoped.gt("category", position[2]);
              })
              .paginate({ ...options, cursor: null })
          );
          const last = stored.page.at(-1);
          const split =
            stored.splitCursor == null
              ? undefined
              : stored.page[Math.floor((stored.page.length - 1) / 2)];
          return {
            ...stored,
            continueCursor: last
              ? categoryPosition(last)
              : (options.cursor ?? ""),
            ...(split ? { splitCursor: categoryPosition(split) } : {}),
          };
        }
      ),
      partition: Effect.fn("article.convex.partition")(
        function* (slot, appLocale, bucket, limit) {
          const [count, articles, categories] = yield* Effect.all([
            Effect.promise(() =>
              ctx.db
                .query("articleBuckets")
                .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .eq("bucket", bucket)
                )
                .unique()
            ),
            Effect.promise(() =>
              ctx.db
                .query("articleCatalog")
                .withIndex(
                  "by_slot_and_appLocale_and_bucket_and_publicPath",
                  (index) =>
                    index
                      .eq("slot", slot)
                      .eq("appLocale", appLocale)
                      .eq("bucket", bucket)
                )
                .take(limit)
            ),
            Effect.promise(() =>
              ctx.db
                .query("articleCategories")
                .withIndex(
                  "by_slot_and_appLocale_and_bucket_and_category",
                  (index) =>
                    index
                      .eq("slot", slot)
                      .eq("appLocale", appLocale)
                      .eq("bucket", bucket)
                )
                .take(limit)
            ),
          ]);
          return { count: Option.fromNullishOr(count), articles, categories };
        }
      ),
      buckets: Effect.fn("article.convex.buckets")((slot, appLocale, limit) =>
        Effect.promise(() =>
          ctx.db
            .query("articleBuckets")
            .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
              index.eq("slot", slot).eq("appLocale", appLocale)
            )
            .take(limit)
        )
      ),
    })
  );
