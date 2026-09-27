import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readQuranDocument } from "@repo/backend/content/quran/document";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranLocaleSources,
  makeQuranMeaning,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect } from "effect";

/** Builds every signed row needed by one two-chunk technical document. */
function documentRows() {
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
  ];
}
describe("contentRelease/quran/document", () => {
  it.effect("returns a normalized unmanaged document", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const _tCtx = yield* MutationCtx;
          expect(
            yield* readQuranDocument("en", 1).pipe(Effect.provide(quranLayer))
          ).toEqual({
            activeManifestHash: null,
            activeReleaseId: null,
            appLocale: "en",
            managed: false,
            preBismillah: null,
            snapshotId: null,
            sourceOrigin: null,
            sourceRevision: null,
            sources: null,
            surah: null,
            tafsirAccess: null,
            verses: [],
          });
        })
      );
    })
  );
  it.effect(
    "projects metadata, footnotes, and only the requested app locale",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, documentRows())
            );
            const document = yield* readQuranDocument("id", 1).pipe(
              Effect.provide(quranLayer)
            );
            expect(document.sources).toEqual(makeQuranLocaleSources("id"));
            expect(document.tafsirAccess).toEqual(
              makeQuranTafsirProjection("id")
            );
            expect(document.surah).toEqual({
              kind: "quran-surah",
              name: {
                arabic: "سورة 1",
                sourceMeaning: makeQuranMeaning(1),
                transliteration: "Technical Surah 1",
              },
              number: 1,
              numberOfVerses: 7,
              revelation: {
                order: 1,
                place: "Meccan",
              },
            });
            expect(document.verses[0]).toEqual({
              arabic: "آية 1",
              number: {
                inQuran: 1,
                inSurah: 1,
              },
              translation: {
                notes: [],
                segments: [
                  {
                    kind: "text",
                    offset: 0,
                    value: "Terjemahan teknis 1",
                  },
                ],
              },
            });
            expect(document.verses).toHaveLength(7);
            expect(JSON.stringify(document)).not.toContain(
              "Technical translation"
            );
            expect(JSON.stringify(document)).not.toContain("Tafsir teknis");
            expect(JSON.stringify(document)).not.toContain("hizbQuarter");
          })
        );
      })
  );
  it.effect("projects the complete signed German translation", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, documentRows())
          );
          const german = yield* readQuranDocument("de", 1).pipe(
            Effect.provide(quranLayer)
          );
          expect(german).toMatchObject({
            appLocale: "de",
            sources: makeQuranLocaleSources("de"),
            surah: {
              name: {
                sourceMeaning: makeQuranMeaning(1),
              },
            },
            tafsirAccess: makeQuranTafsirProjection("de"),
          });
          expect(german.verses.at(0)?.translation).toEqual({
            notes: [],
            segments: [
              {
                kind: "text",
                offset: 0,
                value: "Technische Übersetzung 1",
              },
            ],
          });
        })
      );
    })
  );
  it.effect("rejects invalid, oversized, and incomplete signed documents", () =>
    Effect.gen(function* () {
      const invalid = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* invalid.run(
        Effect.gen(function* () {
          const _invalidCtx = yield* MutationCtx;
          expect(
            yield* readQuranDocument("en", 0).pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INVALID_REQUEST",
          });
          const oversized = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* oversized.run(
            Effect.gen(function* () {
              const oversizedCtx = yield* MutationCtx;
              yield* Effect.promise(() =>
                activateQuranSnapshot(oversizedCtx, [makeQuranSurah(1, 301)])
              );
              expect(
                yield* readQuranDocument("en", 1).pipe(
                  Effect.provide(quranLayer),
                  Effect.flip
                )
              ).toMatchObject({
                code: "CONTENT_RELEASE_LIMIT",
              });
              const incomplete = yield* Confect.pipe(
                Effect.provide(confectLayer)
              );
              yield* incomplete.run(
                Effect.gen(function* () {
                  const incompleteCtx = yield* MutationCtx;
                  yield* Effect.promise(() =>
                    activateQuranSnapshot(
                      incompleteCtx,
                      documentRows().slice(0, -1)
                    )
                  );
                  expect(
                    yield* readQuranDocument("en", 1).pipe(
                      Effect.provide(quranLayer),
                      Effect.flip
                    )
                  ).toMatchObject({
                    code: "CONTENT_RELEASE_INTEGRITY",
                  });
                })
              );
            })
          );
        })
      );
    })
  );
});
