import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { quranViewValidator } from "@repo/backend/content/quran/response";
import { readQuranView } from "@repo/backend/content/quran/view";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranLocaleSources,
  makeQuranMeaning,
  makeQuranSearch,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect, Schema } from "effect";

const encodeView = Schema.encodeSync(
  Schema.fromJsonString(quranViewValidator),
  { onExcessProperty: "error" }
);

/** Builds every verified source row needed by the first Quran page. */
function viewRows() {
  return [
    makeQuranAttribution(),
    makeQuranSurah(1),
    makeQuranSurah(2),
    makeQuranChunk({
      firstQuranNumber: 1,
      firstVerse: 1,
      surahNumber: 1,
      translationFootnotes: {
        en: "[1] Technical English translation note.",
        id: "[4] Catatan teknis terjemahan Indonesia.",
      },
      translationText: {
        en: "Technical translation 1[1]",
        id: "Terjemahan teknis 1[4]",
      },
      verseCount: 1,
    }),
    makeQuranSearch("en", 1),
    makeQuranSearch("id", 1),
  ];
}
describe("contentRelease/quran/view", () => {
  it.effect("fails closed when active surah metadata is absent", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [makeQuranAttribution()])
          );
          expect(
            yield* readQuranView("en", 1).pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: expect.stringContaining("surah:1"),
          });
        })
      );
    })
  );
  it.effect(
    "ends navigation at the final surah and preserves its signed Bismillah",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const arabic = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [
                makeQuranAttribution(),
                makeQuranSurah(113),
                makeQuranSurah(114),
                makeQuranChunk({
                  arabicText: arabic,
                  firstQuranNumber: 1,
                  firstVerse: 1,
                  surahNumber: 1,
                  verseCount: 1,
                }),
                makeQuranChunk({
                  arabicText: `${arabic} النَّاسِ`,
                  firstQuranNumber: 6236,
                  firstVerse: 1,
                  surahNumber: 114,
                  verseCount: 1,
                }),
              ])
            );
            const view = yield* readQuranView("de", 114).pipe(
              Effect.provide(quranLayer)
            );
            expect(view.nextSurah).toBeNull();
            expect(view.previousSurah?.number).toBe(113);
            expect(view.preBismillah?.arabic).toBe(arabic);
            expect(view.verses[0]?.arabic).toBe("النَّاسِ");
          })
        );
      })
  );
  it.effect(
    "rejects a signed opening verse that does not carry its Bismillah prefix",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [
                makeQuranAttribution(),
                makeQuranSurah(1),
                makeQuranSurah(2),
                makeQuranSurah(3),
                makeQuranChunk({
                  arabicText: "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
                  firstQuranNumber: 1,
                  firstVerse: 1,
                  surahNumber: 1,
                  verseCount: 1,
                }),
                makeQuranChunk({
                  arabicText: "الٓمٓ",
                  firstQuranNumber: 2,
                  firstVerse: 1,
                  surahNumber: 2,
                  verseCount: 1,
                }),
              ])
            );
            expect(
              yield* readQuranView("id", 2).pipe(
                Effect.provide(quranLayer),
                Effect.flip
              )
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("Bismillah prefix"),
            });
          })
        );
      })
  );
  it.effect("returns normalized unmanaged app-locale views", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const _tCtx = yield* MutationCtx;
          expect(
            yield* readQuranView("en", 1).pipe(Effect.provide(quranLayer))
          ).toEqual({
            activeManifestHash: null,
            activeReleaseId: null,
            appLocale: "en",
            managed: false,
            nextSurah: null,
            preBismillah: null,
            previousSurah: null,
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
  it.effect("separates the signed Bismillah before Al-Baqarah verse 1", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const arabic = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [
              makeQuranAttribution(),
              makeQuranSurah(1),
              makeQuranSurah(2),
              makeQuranSurah(3),
              makeQuranChunk({
                arabicText: arabic,
                firstQuranNumber: 1,
                firstVerse: 1,
                surahNumber: 1,
                verseCount: 1,
              }),
              makeQuranChunk({
                arabicText: `${arabic} الٓمٓ`,
                firstQuranNumber: 2,
                firstVerse: 1,
                surahNumber: 2,
                verseCount: 1,
              }),
            ])
          );
          const view = yield* readQuranView("id", 2).pipe(
            Effect.provide(quranLayer)
          );
          expect(view.preBismillah).toEqual({
            arabic,
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
          expect(view.verses[0]?.arabic).toBe("الٓمٓ");
        })
      );
    })
  );
  it.effect(
    "projects only the requested app locale without transporting tafsir bodies",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, viewRows())
            );
            const english = yield* readQuranView("en", 1).pipe(
              Effect.provide(quranLayer)
            );
            const indonesian = yield* readQuranView("id", 1).pipe(
              Effect.provide(quranLayer)
            );
            expect(english.nextSurah).toEqual({
              name: {
                arabic: "سورة 2",
                sourceMeaning: makeQuranMeaning(2),
                transliteration: "Technical Surah 2",
              },
              number: 2,
              numberOfVerses: 1,
            });
            expect(english.previousSurah).toBeNull();
            expect(english.surah).toEqual({
              name: {
                arabic: "سورة 1",
                sourceMeaning: makeQuranMeaning(1),
                transliteration: "Technical Surah 1",
              },
              number: 1,
              numberOfVerses: 1,
            });
            expect(english.sources).toEqual(makeQuranLocaleSources("en"));
            expect(english.tafsirAccess).toEqual(
              makeQuranTafsirProjection("en")
            );
            expect(english.verses).toEqual([
              {
                arabic: "آية 1",
                number: {
                  inQuran: 1,
                  inSurah: 1,
                },
                translation: {
                  notes: [
                    {
                      number: 1,
                      referenceOffset: 23,
                      text: "Technical English translation note.",
                    },
                  ],
                  segments: [
                    {
                      kind: "text",
                      offset: 0,
                      value: "Technical translation 1",
                    },
                    {
                      kind: "note",
                      number: 1,
                      offset: 23,
                    },
                  ],
                },
              },
            ]);
            expect(indonesian.verses).toEqual([
              {
                arabic: "آية 1",
                number: {
                  inQuran: 1,
                  inSurah: 1,
                },
                translation: {
                  notes: [
                    {
                      number: 4,
                      referenceOffset: 19,
                      text: "Catatan teknis terjemahan Indonesia.",
                    },
                  ],
                  segments: [
                    {
                      kind: "text",
                      offset: 0,
                      value: "Terjemahan teknis 1",
                    },
                    {
                      kind: "note",
                      number: 4,
                      offset: 19,
                    },
                  ],
                },
              },
            ]);
            expect(indonesian.sources).toEqual(makeQuranLocaleSources("id"));
            expect(indonesian.tafsirAccess).toEqual(
              makeQuranTafsirProjection("id")
            );
            expect(indonesian.nextSurah?.name.sourceMeaning).toEqual(
              makeQuranMeaning(2)
            );
            expect(indonesian.surah?.name.sourceMeaning).toEqual(
              makeQuranMeaning(1)
            );
            expect(encodeView(indonesian)).not.toContain("Tafsir teknis");
            expect({
              english: english.appLocale,
              indonesian: indonesian.appLocale,
            }).toEqual({
              english: "en",
              indonesian: "id",
            });
          })
        );
      })
  );
  it.effect("does not read the unrelated signed search projection", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(
              tCtx,
              viewRows().filter((row) => row.kind !== "quran-search")
            )
          );
          expect(
            yield* readQuranView("id", 1).pipe(Effect.provide(quranLayer))
          ).toMatchObject({
            snapshotId,
            verses: [
              {
                number: {
                  inQuran: 1,
                  inSurah: 1,
                },
                translation: {
                  notes: [
                    {
                      number: 4,
                      referenceOffset: 19,
                      text: "Catatan teknis terjemahan Indonesia.",
                    },
                  ],
                  segments: [
                    {
                      kind: "text",
                      offset: 0,
                      value: "Terjemahan teknis 1",
                    },
                    {
                      kind: "note",
                      number: 4,
                      offset: 19,
                    },
                  ],
                },
              },
            ],
          });
        })
      );
    })
  );
});
