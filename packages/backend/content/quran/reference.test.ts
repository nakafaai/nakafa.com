import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readQuranPassage } from "@repo/backend/content/quran/reference";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Array as Arr, Effect } from "effect";

/** Creates two chunks and their signed metadata for one seven-verse surah. */
function referenceRows() {
  return [
    makeQuranAttribution(),
    makeQuranSurah(1, 7),
    makeQuranChunk({
      firstQuranNumber: 1,
      firstVerse: 1,
      surahNumber: 1,
      verseCount: 6,
    }),
    makeQuranChunk({
      firstQuranNumber: 7,
      firstVerse: 7,
      surahNumber: 1,
      verseCount: 1,
    }),
    makeQuranSearch("en", 1),
  ];
}
describe("contentRelease/quran/reference", () => {
  it.effect(
    "returns a normalized unmanaged range before Quran activation",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const _tCtx = yield* MutationCtx;
            expect(
              yield* readQuranPassage({
                fromVerse: 2,
                appLocale: "en",
                surahNumber: 1,
              }).pipe(Effect.provide(quranLayer))
            ).toMatchObject({
              fromVerse: 2,
              managed: false,
              toVerse: 2,
            });
          })
        );
      })
  );
  it.effect("returns only the signed chunks covering one localized range", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, referenceRows())
          );
          expect(
            yield* readQuranPassage({
              fromVerse: 6,
              appLocale: "en",
              surahNumber: 1,
              toVerse: 7,
            }).pipe(Effect.provide(quranLayer))
          ).toMatchObject({
            chunkJson: [expect.any(String), expect.any(String)],
            fromVerse: 6,
            managed: true,
            searchJson: expect.any(String),
            snapshotId,
            surahJson: expect.any(String),
            toVerse: 7,
          });
        })
      );
    })
  );
  it.effect("rejects references beyond the signed surah boundary", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, referenceRows())
          );
          expect(
            yield* readQuranPassage({
              fromVerse: 7,
              appLocale: "en",
              surahNumber: 1,
              toVerse: 8,
            }).pipe(Effect.provide(quranLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INVALID_REQUEST",
          });
        })
      );
    })
  );
  it.effect("rejects a surah that exceeds the bounded page contract", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [makeQuranSurah(1, 301)])
          );
          expect(
            yield* readQuranPassage({
              fromVerse: 1,
              appLocale: "en",
              surahNumber: 1,
            }).pipe(Effect.provide(quranLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_LIMIT",
          });
        })
      );
    })
  );
  it.effect("requires the signed search row used by public references", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(
              tCtx,
              Arr.filter(referenceRows(), (row) => row.kind !== "quran-search")
            )
          );
          expect(
            yield* readQuranPassage({
              fromVerse: 1,
              appLocale: "en",
              surahNumber: 1,
            }).pipe(Effect.provide(quranLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
});
