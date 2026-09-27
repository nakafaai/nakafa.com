import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  decodeMaterialPosition,
  isMaterialPosition,
  materialPosition,
} from "@repo/backend/content/material/cursor";
import { MaterialSource } from "@repo/backend/content/material/source";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { Effect, Layer, Option, Predicate } from "effect";

/** Reads material identities and groups through their native ordered indexes. */
export const materialLayer = Layer.merge(
  publicationLayer,
  Layer.effect(
    MaterialSource,
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      return MaterialSource.of({
        material: Effect.fn("material.database.identity")(
          function* (slot, contentKey, appLocale) {
            return yield* database
              .table("materialCatalog")
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
        byPublicPath: Effect.fn("material.database.byPublicPath")(
          function* (slot, appLocale, publicPath) {
            return yield* database
              .table("materialCatalog")
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
        byAssetId: Effect.fn("material.database.byAssetId")(
          function* (slot, appLocale, assetId) {
            return yield* database
              .table("materialCatalog")
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
        topicByPublicPath: Effect.fn("material.database.topicByPublicPath")(
          function* (slot, appLocale, publicPath) {
            return yield* database
              .table("materialCatalog")
              .index(
                "by_slot_and_appLocale_and_parentPath_and_order_and_publicPath",
                (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .eq("parentPath", publicPath)
              )
              .first()
              .pipe(
                Effect.map(Option.getOrNull),
                Effect.orDie,
                Effect.map(Option.fromNullishOr)
              );
          }
        ),
        topicByAssetId: Effect.fn("material.database.topicByAssetId")(
          function* (slot, appLocale, assetId) {
            return yield* database
              .table("materialCatalog")
              .index(
                "by_slot_and_appLocale_and_topicAssetId_and_assetId",
                (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .eq("topicAssetId", assetId)
              )
              .first()
              .pipe(
                Effect.map(Option.getOrNull),
                Effect.orDie,
                Effect.map(Option.fromNullishOr)
              );
          }
        ),
        latest: Effect.fn("material.database.latest")(
          function* (slot, appLocale, limit) {
            return yield* database
              .table("materialCatalog")
              .index(
                "by_slot_and_appLocale_and_datePublished_and_contentKey",
                (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .gte("datePublished", ""),
                "desc"
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
        page: Effect.fn("material.database.page")(
          function* (slot, appLocale, options) {
            if (
              options.cursor !== null &&
              !isMaterialPosition(options.cursor)
            ) {
              return yield* database
                .table("materialCatalog")
                .index("by_slot_and_appLocale_and_publicPath", (index) =>
                  index.eq("slot", slot).eq("appLocale", appLocale)
                )
                .paginate(options)
                .pipe(Effect.orDie);
            }
            const position = yield* decodeMaterialPosition(
              options.cursor,
              slot,
              appLocale
            );
            const stored = yield* database
              .table("materialCatalog")
              .index("by_slot_and_appLocale_and_publicPath", (index) => {
                const scoped = index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale);
                return position === null
                  ? scoped
                  : scoped.gt("publicPath", position[2]);
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
                ? materialPosition(last)
                : (options.cursor ?? ""),
              ...(split
                ? {
                    splitCursor: materialPosition(split),
                  }
                : {}),
            };
          }
        ),
        partition: Effect.fn("material.database.partition")(function* (
          slot,
          appLocale,
          bucket,
          limit
        ) {
          const count = yield* database
            .table("materialBuckets")
            .get("by_slot_and_appLocale_and_bucket", slot, appLocale, bucket)
            .pipe(
              Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null))
            );
          if (!count) {
            return {
              count: Option.none(),
              materials: [],
            };
          }
          const materials = yield* database
            .table("materialCatalog")
            .index("by_slot_and_appLocale_and_bucket_and_publicPath", (index) =>
              index
                .eq("slot", slot)
                .eq("appLocale", appLocale)
                .eq("bucket", bucket)
            )
            .take(limit);
          return {
            count: Option.some(count),
            materials,
          };
        }, Effect.orDie),
        buckets: Effect.fn("material.database.buckets")(
          function* (slot, appLocale, limit) {
            return yield* database
              .table("materialBuckets")
              .index("by_slot_and_appLocale_and_bucket", (index) =>
                index.eq("slot", slot).eq("appLocale", appLocale)
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
        siblings: Effect.fn("material.database.siblings")(
          function* (slot, appLocale, materialKey, limit) {
            return yield* database
              .table("materialCatalog")
              .index(
                "by_slot_and_appLocale_and_materialKey_and_order_and_publicPath",
                (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .eq("materialKey", materialKey)
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
      });
    })
  )
);
