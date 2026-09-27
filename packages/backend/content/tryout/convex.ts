import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { findTryoutRuntimeBundleByHash } from "@repo/backend/confect/tryouts/runtime/signed";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Layer, Option } from "effect";

/** Preserves the live hierarchy's existing bounded transactional indexes. */
export const convexTryoutLayer = (ctx: QueryCtx) =>
  Layer.merge(
    convexPublicationLayer(ctx),
    Layer.succeed(TryoutSource, {
      catalog: Effect.fn("tryout.convex.catalog")(
        function* (snapshotId, appLocale, limit) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
          return yield* database
            .table("tryoutCatalog")
            .index("by_snapshotId_and_appLocale_and_publicPath", (index) =>
              index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
            )
            .take(limit)
            .pipe(Effect.orDie);
        }
      ),
      identity: Effect.fn("tryout.convex.identity")(
        function* (snapshotId, identity) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
          return yield* database
            .table("tryoutCatalog")
            .get("by_snapshotId_and_identity", snapshotId, identity)
            .pipe(
              Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
              Effect.orDie,
              Effect.map(Option.fromNullishOr)
            );
        }
      ),
      path: Effect.fn("tryout.convex.path")(
        function* (snapshotId, appLocale, publicPath) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
          return yield* database
            .table("tryoutCatalog")
            .get(
              "by_snapshotId_and_appLocale_and_publicPath",
              snapshotId,
              appLocale,
              publicPath
            )
            .pipe(
              Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
              Effect.orDie,
              Effect.map(Option.fromNullishOr)
            );
        }
      ),
      asset: Effect.fn("tryout.convex.asset")(
        function* (snapshotId, appLocale, assetId, limit) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
          return yield* database
            .table("tryoutCatalog")
            .index("by_snapshotId_and_appLocale_and_assetId", (index) =>
              index
                .eq("snapshotId", snapshotId)
                .eq("appLocale", appLocale)
                .eq("assetId", assetId)
            )
            .take(limit)
            .pipe(Effect.orDie);
        }
      ),
      sections: Effect.fn("tryout.convex.sections")(
        function* (snapshotId, setIdentity, limit) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
          return yield* database
            .table("tryoutCatalog")
            .index(
              "by_snapshotId_and_setIdentity_and_kind_and_order",
              (index) =>
                index
                  .eq("snapshotId", snapshotId)
                  .eq("setIdentity", setIdentity)
                  .eq("kind", "section")
            )
            .take(limit)
            .pipe(Effect.orDie);
        }
      ),
      placements: Effect.fn("tryout.convex.placements")(
        function* (snapshotId, section, limit) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
          return yield* database
            .table("tryoutPlacements")
            .index(
              "by_snapshotId_and_appLocale_and_section_and_questionOrder",
              (index) =>
                index
                  .eq("snapshotId", snapshotId)
                  .eq("appLocale", section.appLocale)
                  .eq("countryKey", section.countryKey)
                  .eq("examKey", section.examKey)
                  .eq("trackKey", section.trackKey)
                  .eq("setKey", section.setKey)
                  .eq("sectionKey", section.sectionKey)
            )
            .take(limit)
            .pipe(Effect.orDie);
        }
      ),
      body: Effect.fn("tryout.convex.body")(function* (snapshotId, selector) {
        const placements = DatabaseReader.make(databaseSchema, ctx.db).table(
          "tryoutPlacements"
        );
        const query =
          selector.delivery === "authenticated"
            ? placements.index(
                "by_snapshotId_and_questionArtifactHash",
                (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("questionArtifactHash", selector.artifactHash)
              )
            : placements.index(
                "by_snapshotId_and_answerArtifactHash",
                (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("answerArtifactHash", selector.artifactHash)
              );
        return yield* query.first().pipe(Effect.orDie);
      }),
      bundle: Effect.fn("tryout.convex.bundle")((bundleHash) =>
        findTryoutRuntimeBundleByHash(ctx, bundleHash).pipe(
          Effect.map(Option.fromNullishOr)
        )
      ),
    })
  );
