import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  paginateArticles,
  readOrderedArticles,
} from "@repo/backend/confect/contentRelease/article/order";
import {
  categoryPosition,
  decodeCategoryPosition,
  isCategoryPosition,
} from "@repo/backend/content/article/category-cursor";
import { ArticleSource } from "@repo/backend/content/article/source";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { Effect, Layer, Option, Predicate } from "effect";

/** Preserves native article indexes and every deployed publication cursor. */
export const articleLayer = Layer.merge(
  publicationLayer,
  Layer.effect(
    ArticleSource,
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      return ArticleSource.of({
        article: Effect.fn("article.database.identity")(
          function* (slot, contentKey, appLocale) {
            return yield* database
              .table("articleCatalog")
              .get(
                "by_slot_and_contentKey_and_appLocale",
                slot,
                contentKey,
                appLocale
              )
              .pipe(
                Effect.catchTag("GetByIndexFailure", () =>
                  Effect.succeed(null)
                ),
                Effect.orDie,
                Effect.map(Option.fromNullishOr)
              );
          }
        ),
        byPublicPath: Effect.fn("article.database.byPublicPath")(
          function* (slot, appLocale, publicPath) {
            return yield* database
              .table("articleCatalog")
              .index("by_slot_and_appLocale_and_publicPath", (index) =>
                index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale)
                  .eq("publicPath", publicPath)
              )
              .take(2)
              .pipe(Effect.orDie);
          }
        ),
        byAssetId: Effect.fn("article.database.byAssetId")(
          function* (slot, appLocale, assetId) {
            return yield* database
              .table("articleCatalog")
              .index("by_slot_and_appLocale_and_assetId", (index) =>
                index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale)
                  .eq("assetId", assetId)
              )
              .take(2)
              .pipe(Effect.orDie);
          }
        ),
        ordered: Effect.fn("article.database.ordered")(
          (slot, appLocale, category, limit) =>
            readOrderedArticles(slot, appLocale, category, limit).pipe(
              Effect.provideService(DatabaseReader, database)
            )
        ),
        publications: Effect.fn("article.database.publications")(
          (slot, appLocale, category, options) =>
            paginateArticles(slot, appLocale, category, options).pipe(
              Effect.provideService(DatabaseReader, database)
            )
        ),
        categories: Effect.fn("article.database.categories")(
          function* (slot, appLocale, options) {
            if (
              options.cursor !== null &&
              !isCategoryPosition(options.cursor)
            ) {
              return yield* database
                .table("articleCategories")
                .index("by_slot_and_appLocale_and_category", (index) =>
                  index.eq("slot", slot).eq("appLocale", appLocale)
                )
                .paginate(options)
                .pipe(Effect.orDie);
            }
            const position = yield* decodeCategoryPosition(
              options.cursor,
              slot,
              appLocale
            );
            const stored = yield* database
              .table("articleCategories")
              .index("by_slot_and_appLocale_and_category", (index) => {
                const scoped = index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale);
                return position === null
                  ? scoped
                  : scoped.gt("category", position[2]);
              })
              .paginate({
                ...options,
                cursor: null,
              })
              .pipe(Effect.orDie);
            const last = stored.page.at(-1);
            const split = Predicate.isNullish(stored.splitCursor)
              ? undefined
              : stored.page[Math.floor((stored.page.length - 1) / 2)];
            return {
              ...stored,
              continueCursor: last
                ? categoryPosition(last)
                : (options.cursor ?? ""),
              ...(split
                ? {
                    splitCursor: categoryPosition(split),
                  }
                : {}),
            };
          }
        ),
        partition: Effect.fn("article.database.partition")(
          function* (slot, appLocale, bucket, limit) {
            const [count, articles, categories] = yield* Effect.all([
              database
                .table("articleBuckets")
                .get(
                  "by_slot_and_appLocale_and_bucket",
                  slot,
                  appLocale,
                  bucket
                )
                .pipe(
                  Effect.catchTag("GetByIndexFailure", () =>
                    Effect.succeed(null)
                  ),
                  Effect.orDie
                ),
              database
                .table("articleCatalog")
                .index(
                  "by_slot_and_appLocale_and_bucket_and_publicPath",
                  (index) =>
                    index
                      .eq("slot", slot)
                      .eq("appLocale", appLocale)
                      .eq("bucket", bucket)
                )
                .take(limit)
                .pipe(Effect.orDie),
              database
                .table("articleCategories")
                .index(
                  "by_slot_and_appLocale_and_bucket_and_category",
                  (index) =>
                    index
                      .eq("slot", slot)
                      .eq("appLocale", appLocale)
                      .eq("bucket", bucket)
                )
                .take(limit)
                .pipe(Effect.orDie),
            ]);
            return {
              count: Option.fromNullishOr(count),
              articles,
              categories,
            };
          }
        ),
        buckets: Effect.fn("article.database.buckets")(
          function* (slot, appLocale, limit) {
            return yield* database
              .table("articleBuckets")
              .index("by_slot_and_appLocale_and_bucket", (index) =>
                index.eq("slot", slot).eq("appLocale", appLocale)
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
      });
    })
  )
);
