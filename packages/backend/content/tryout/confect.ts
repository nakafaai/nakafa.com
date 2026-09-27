import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { findTryoutRuntimeBundleByHash } from "@repo/backend/confect/tryouts/runtime/signed";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { TryoutSource } from "@repo/backend/content/tryout/source";
import { Effect, Layer, Option } from "effect";

/** Preserves the live hierarchy's existing bounded transactional indexes. */
export const tryoutLayer = Layer.merge(
  publicationLayer,
  Layer.effect(
    TryoutSource,
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      return TryoutSource.of({
        catalog: Effect.fn("tryout.database.catalog")(
          function* (snapshotId, appLocale, limit) {
            return yield* database
              .table("tryoutCatalog")
              .index("by_snapshotId_and_appLocale_and_publicPath", (index) =>
                index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
        identity: Effect.fn("tryout.database.identity")(
          function* (snapshotId, identity) {
            return yield* database
              .table("tryoutCatalog")
              .get("by_snapshotId_and_identity", snapshotId, identity)
              .pipe(
                Effect.catchTag("GetByIndexFailure", () =>
                  Effect.succeed(null)
                ),
                Effect.orDie,
                Effect.map(Option.fromNullishOr)
              );
          }
        ),
        path: Effect.fn("tryout.database.path")(
          function* (snapshotId, appLocale, publicPath) {
            return yield* database
              .table("tryoutCatalog")
              .get(
                "by_snapshotId_and_appLocale_and_publicPath",
                snapshotId,
                appLocale,
                publicPath
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
        asset: Effect.fn("tryout.database.asset")(
          function* (snapshotId, appLocale, assetId, limit) {
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
        sections: Effect.fn("tryout.database.sections")(
          function* (snapshotId, setIdentity, limit) {
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
        placements: Effect.fn("tryout.database.placements")(
          function* (snapshotId, section, limit) {
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
        body: Effect.fn("tryout.database.body")(
          function* (snapshotId, selector) {
            const placements = database.table("tryoutPlacements");
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
          }
        ),
        bundle: Effect.fn("tryout.database.bundle")(
          (bundleHash) =>
            findTryoutRuntimeBundleByHash(bundleHash).pipe(
              Effect.map(Option.fromNullishOr)
            ),
          Effect.provideService(DatabaseReader, database)
        ),
      });
    })
  )
);
