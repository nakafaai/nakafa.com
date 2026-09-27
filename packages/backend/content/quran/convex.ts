import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { QuranSource } from "@repo/backend/content/quran/source";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect, Layer, Option } from "effect";

/** Keeps live Quran reads on their existing bounded Convex indexes. */
export const convexQuranLayer = (ctx: QueryCtx) =>
  Layer.merge(
    convexPublicationLayer(ctx),
    Layer.succeed(QuranSource, {
      search: Effect.fn("quran.convex.search")(
        function* (snapshotId, appLocale, assetId) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
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
      row: Effect.fn("quran.convex.row")(function* (snapshotId, identity) {
        const database = DatabaseReader.make(databaseSchema, ctx.db);
        return yield* database
          .table("quranRows")
          .get("by_snapshotId_and_identity", snapshotId, identity)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
            Effect.orDie,
            Effect.map(Option.fromNullishOr)
          );
      }),
      metadata: Effect.fn("quran.convex.metadata")(
        function* (snapshotId, kind, limit) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
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
      chunks: Effect.fn("quran.convex.chunks")(
        function* (snapshotId, surahNumber, firstVerse, lastVerse, limit) {
          const database = DatabaseReader.make(databaseSchema, ctx.db);
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
    })
  );
