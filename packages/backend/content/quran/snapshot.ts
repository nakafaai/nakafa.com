import type { PublicationRow } from "@repo/backend/content/publication/source";
import { QuranSource } from "@repo/backend/content/quran/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Layer, Option } from "effect";

/** Reads immutable Quran values after the serving archive has been verified. */
export const snapshotQuranLayer = (tables: {
  readonly quranRows: readonly PublicationRow<"quranRows">[];
  readonly quranSearch: readonly PublicationRow<"quranSearch">[];
}) =>
  Layer.effect(
    QuranSource,
    Effect.gen(function* () {
      const identities = new Map<string, PublicationRow<"quranRows">>();
      const metadata = new Map<string, PublicationRow<"quranRows">[]>();
      const chunks = new Map<string, PublicationRow<"quranRows">[]>();
      const searches = new Map<string, PublicationRow<"quranSearch">[]>();
      for (const row of tables.quranSearch) {
        const key = JSON.stringify([
          row.snapshotId,
          row.appLocale,
          row.assetId,
        ]);
        const group = searches.get(key) ?? [];
        group.push(row);
        searches.set(key, group);
      }
      for (const row of tables.quranRows) {
        const identity = JSON.stringify([row.snapshotId, row.identity]);
        if (identities.has(identity)) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Signed Quran snapshot contains a duplicate row identity."
          );
        }
        identities.set(identity, row);
        const group = JSON.stringify([row.snapshotId, row.kind]);
        const selected = metadata.get(group) ?? [];
        selected.push(row);
        metadata.set(group, selected);
        if (row.kind === "quran-chunk") {
          const key = JSON.stringify([row.snapshotId, row.surahNumber]);
          const group = chunks.get(key) ?? [];
          group.push(row);
          chunks.set(key, group);
        }
      }
      for (const group of metadata.values()) {
        group.sort(
          (a, b) =>
            (a.surahNumber ?? 0) - (b.surahNumber ?? 0) ||
            (a.firstVerse ?? 0) - (b.firstVerse ?? 0)
        );
      }
      for (const group of chunks.values()) {
        group.sort((a, b) => (a.firstVerse ?? 0) - (b.firstVerse ?? 0));
      }
      return QuranSource.of({
        search: Effect.fn("quran.snapshot.search")(
          (snapshotId, appLocale, assetId) =>
            Effect.sync(() =>
              (
                searches.get(
                  JSON.stringify([snapshotId, appLocale, assetId])
                ) ?? []
              ).slice(0, 2)
            )
        ),
        row: Effect.fn("quran.snapshot.row")((snapshotId, identity) =>
          Effect.sync(() =>
            Option.fromUndefinedOr(
              identities.get(JSON.stringify([snapshotId, identity]))
            )
          )
        ),
        metadata: Effect.fn("quran.snapshot.metadata")(
          (snapshotId, kind, limit) =>
            Effect.sync(() =>
              (metadata.get(JSON.stringify([snapshotId, kind])) ?? []).slice(
                0,
                limit
              )
            )
        ),
        chunks: Effect.fn("quran.snapshot.chunks")(
          (snapshotId, surahNumber, firstVerse, lastVerse, limit) =>
            Effect.sync(() =>
              (chunks.get(JSON.stringify([snapshotId, surahNumber])) ?? [])
                .filter(
                  (row) =>
                    row.surahNumber === surahNumber &&
                    row.firstVerse !== undefined &&
                    row.firstVerse >= firstVerse &&
                    row.firstVerse <= lastVerse
                )
                .slice(0, limit)
            )
        ),
      });
    })
  );
