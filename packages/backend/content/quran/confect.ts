import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { publicationLayer } from "@repo/backend/content/publication/confect";
import { QuranSource } from "@repo/backend/content/quran/source";
import { Effect, Layer, Option } from "effect";

/** Keeps live Quran reads on their existing bounded Convex indexes. */
export const quranLayer = Layer.merge(
  publicationLayer,
  Layer.effect(
    QuranSource,
    Effect.gen(function* () {
      const database = yield* DatabaseReader;
      return QuranSource.of({
        search: Effect.fn("quran.database.search")(
          function* (snapshotId, appLocale, assetId) {
            return yield* database
              .table("quranSearch")
              .index("by_snapshotId_and_appLocale_and_assetId", (index) =>
                index
                  .eq("snapshotId", snapshotId)
                  .eq("appLocale", appLocale)
                  .eq("assetId", assetId)
              )
              .take(2)
              .pipe(Effect.orDie);
          }
        ),
        row: Effect.fn("quran.database.row")(function* (snapshotId, identity) {
          return yield* database
            .table("quranRows")
            .get("by_snapshotId_and_identity", snapshotId, identity)
            .pipe(
              Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
              Effect.orDie,
              Effect.map(Option.fromNullishOr)
            );
        }),
        metadata: Effect.fn("quran.database.metadata")(
          function* (snapshotId, kind, limit) {
            return yield* database
              .table("quranRows")
              .index(
                "by_snapshotId_and_kind_and_surahNumber_and_firstVerse",
                (index) => index.eq("snapshotId", snapshotId).eq("kind", kind)
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
        chunks: Effect.fn("quran.database.chunks")(
          function* (snapshotId, surahNumber, firstVerse, lastVerse, limit) {
            return yield* database
              .table("quranRows")
              .index(
                "by_snapshotId_and_kind_and_surahNumber_and_firstVerse",
                (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq("kind", "quran-chunk")
                    .eq("surahNumber", surahNumber)
                    .gte("firstVerse", firstVerse)
                    .lte("firstVerse", lastVerse)
              )
              .take(limit)
              .pipe(Effect.orDie);
          }
        ),
      });
    })
  )
);
