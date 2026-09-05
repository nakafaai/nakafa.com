import {
  decodeMaterialPosition,
  isMaterialPosition,
  materialPosition,
} from "@repo/backend/content/material/cursor";
import { MaterialSource } from "@repo/backend/content/material/source";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Layer, Option } from "effect";

/** Reads material identities and groups through their native ordered indexes. */
export const convexMaterialLayer = (ctx: QueryCtx) =>
  Layer.merge(
    convexPublicationLayer(ctx),
    Layer.succeed(MaterialSource, {
      material: Effect.fn("material.convex.identity")(
        (slot, contentKey, appLocale) =>
          Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
                index
                  .eq("slot", slot)
                  .eq("contentKey", contentKey)
                  .eq("appLocale", appLocale)
              )
              .unique()
          ).pipe(Effect.map(Option.fromNullishOr))
      ),
      byPublicPath: Effect.fn("material.convex.byPublicPath")(
        (slot, appLocale, publicPath) =>
          Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex("by_slot_and_appLocale_and_publicPath", (index) =>
                index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale)
                  .eq("publicPath", publicPath)
              )
              .take(2)
          )
      ),
      byAssetId: Effect.fn("material.convex.byAssetId")(
        (slot, appLocale, assetId) =>
          Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex("by_slot_and_appLocale_and_assetId", (index) =>
                index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale)
                  .eq("assetId", assetId)
              )
              .take(2)
          )
      ),
      topicByPublicPath: Effect.fn("material.convex.topicByPublicPath")(
        (slot, appLocale, publicPath) =>
          Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex(
                "by_slot_and_appLocale_and_parentPath_and_order_and_publicPath",
                (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .eq("parentPath", publicPath)
              )
              .first()
          ).pipe(Effect.map(Option.fromNullishOr))
      ),
      topicByAssetId: Effect.fn("material.convex.topicByAssetId")(
        (slot, appLocale, assetId) =>
          Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex(
                "by_slot_and_appLocale_and_topicAssetId_and_assetId",
                (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .eq("topicAssetId", assetId)
              )
              .first()
          ).pipe(Effect.map(Option.fromNullishOr))
      ),
      latest: Effect.fn("material.convex.latest")((slot, appLocale, limit) =>
        Effect.promise(() =>
          ctx.db
            .query("materialCatalog")
            .withIndex(
              "by_slot_and_appLocale_and_datePublished_and_contentKey",
              (index) =>
                index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale)
                  .gte("datePublished", "")
            )
            .order("desc")
            .take(limit)
        )
      ),
      page: Effect.fn("material.convex.page")(
        function* (slot, appLocale, options) {
          if (options.cursor !== null && !isMaterialPosition(options.cursor)) {
            return yield* Effect.promise(() =>
              ctx.db
                .query("materialCatalog")
                .withIndex("by_slot_and_appLocale_and_publicPath", (index) =>
                  index.eq("slot", slot).eq("appLocale", appLocale)
                )
                .paginate(options)
            );
          }
          const position = yield* decodeMaterialPosition(
            options.cursor,
            slot,
            appLocale
          );
          const stored = yield* Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex("by_slot_and_appLocale_and_publicPath", (index) => {
                const scoped = index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale);
                return position === null
                  ? scoped
                  : scoped.gt("publicPath", position[2]);
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
              ? materialPosition(last)
              : (options.cursor ?? ""),
            ...(split ? { splitCursor: materialPosition(split) } : {}),
          };
        }
      ),
      partition: Effect.fn("material.convex.partition")(
        function* (slot, appLocale, bucket, limit) {
          const count = yield* Effect.promise(() =>
            ctx.db
              .query("materialBuckets")
              .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
                index
                  .eq("slot", slot)
                  .eq("appLocale", appLocale)
                  .eq("bucket", bucket)
              )
              .unique()
          );
          if (!count) {
            return { count: Option.none(), materials: [] };
          }
          const materials = yield* Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex(
                "by_slot_and_appLocale_and_bucket_and_publicPath",
                (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .eq("bucket", bucket)
              )
              .take(limit)
          );
          return { count: Option.some(count), materials };
        }
      ),
      buckets: Effect.fn("material.convex.buckets")((slot, appLocale, limit) =>
        Effect.promise(() =>
          ctx.db
            .query("materialBuckets")
            .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
              index.eq("slot", slot).eq("appLocale", appLocale)
            )
            .take(limit)
        )
      ),
      siblings: Effect.fn("material.convex.siblings")(
        (slot, appLocale, materialKey, limit) =>
          Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex(
                "by_slot_and_appLocale_and_materialKey_and_order_and_publicPath",
                (index) =>
                  index
                    .eq("slot", slot)
                    .eq("appLocale", appLocale)
                    .eq("materialKey", materialKey)
              )
              .take(limit)
          )
      ),
    })
  );
