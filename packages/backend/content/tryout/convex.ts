import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { findTryoutRuntimeBundleByHash } from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect, Layer, Option } from "effect";

/** Preserves the live hierarchy's existing bounded transactional indexes. */
export const convexTryoutLayer = (ctx: QueryCtx) =>
  Layer.merge(
    convexPublicationLayer(ctx),
    Layer.succeed(TryoutSource, {
      catalog: Effect.fn("tryout.convex.catalog")(
        (snapshotId, appLocale, limit) =>
          Effect.promise(() =>
            ctx.db
              .query("tryoutCatalog")
              .withIndex(
                "by_snapshotId_and_appLocale_and_publicPath",
                (index) =>
                  index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
              )
              .take(limit)
          )
      ),
      identity: Effect.fn("tryout.convex.identity")((snapshotId, identity) =>
        Effect.promise(() =>
          ctx.db
            .query("tryoutCatalog")
            .withIndex("by_snapshotId_and_identity", (index) =>
              index.eq("snapshotId", snapshotId).eq("identity", identity)
            )
            .unique()
        ).pipe(Effect.map(Option.fromNullishOr))
      ),
      path: Effect.fn("tryout.convex.path")(
        (snapshotId, appLocale, publicPath) =>
          Effect.promise(() =>
            ctx.db
              .query("tryoutCatalog")
              .withIndex(
                "by_snapshotId_and_appLocale_and_publicPath",
                (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("appLocale", appLocale)
                    .eq("publicPath", publicPath)
              )
              .unique()
          ).pipe(Effect.map(Option.fromNullishOr))
      ),
      asset: Effect.fn("tryout.convex.asset")(
        (snapshotId, appLocale, assetId, limit) =>
          Effect.promise(() =>
            ctx.db
              .query("tryoutCatalog")
              .withIndex("by_snapshotId_and_appLocale_and_assetId", (index) =>
                index
                  .eq("snapshotId", snapshotId)
                  .eq("appLocale", appLocale)
                  .eq("assetId", assetId)
              )
              .take(limit)
          )
      ),
      sections: Effect.fn("tryout.convex.sections")(
        (snapshotId, setIdentity, limit) =>
          Effect.promise(() =>
            ctx.db
              .query("tryoutCatalog")
              .withIndex(
                "by_snapshotId_and_setIdentity_and_kind_and_order",
                (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("setIdentity", setIdentity)
                    .eq("kind", "section")
              )
              .take(limit)
          )
      ),
      placements: Effect.fn("tryout.convex.placements")(
        (snapshotId, section, limit) =>
          Effect.promise(() =>
            ctx.db
              .query("tryoutPlacements")
              .withIndex(
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
          )
      ),
      body: Effect.fn("tryout.convex.body")((snapshotId, selector) =>
        Effect.promise(() =>
          selector.delivery === "authenticated"
            ? ctx.db
                .query("tryoutPlacements")
                .withIndex("by_snapshotId_and_questionArtifactHash", (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("questionArtifactHash", selector.artifactHash)
                )
                .first()
            : ctx.db
                .query("tryoutPlacements")
                .withIndex("by_snapshotId_and_answerArtifactHash", (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("answerArtifactHash", selector.artifactHash)
                )
                .first()
        ).pipe(Effect.map(Option.fromNullishOr))
      ),
      bundle: Effect.fn("tryout.convex.bundle")((bundleHash) =>
        findTryoutRuntimeBundleByHash(ctx, bundleHash).pipe(
          Effect.map(Option.fromNullishOr)
        )
      ),
    })
  );
