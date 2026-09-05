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
        (snapshotId, appLocale, assetId) =>
          Effect.promise(() =>
            ctx.db
              .query("quranSearch")
              .withIndex("by_snapshotId_and_appLocale_and_assetId", (index) =>
                index
                  .eq("snapshotId", snapshotId)
                  .eq("appLocale", appLocale)
                  .eq("assetId", assetId)
              )
              .take(2)
          )
      ),
      row: Effect.fn("quran.convex.row")((snapshotId, identity) =>
        Effect.promise(() =>
          ctx.db
            .query("quranRows")
            .withIndex("by_snapshotId_and_identity", (index) =>
              index.eq("snapshotId", snapshotId).eq("identity", identity)
            )
            .unique()
        ).pipe(Effect.map(Option.fromNullishOr))
      ),
      metadata: Effect.fn("quran.convex.metadata")((snapshotId, kind, limit) =>
        Effect.promise(() =>
          ctx.db
            .query("quranRows")
            .withIndex(
              "by_snapshotId_and_kind_and_surahNumber_and_firstVerse",
              (index) => index.eq("snapshotId", snapshotId).eq("kind", kind)
            )
            .take(limit)
        )
      ),
      chunks: Effect.fn("quran.convex.chunks")(
        (snapshotId, surahNumber, firstVerse, lastVerse, limit) =>
          Effect.promise(() =>
            ctx.db
              .query("quranRows")
              .withIndex(
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
          )
      ),
    })
  );
