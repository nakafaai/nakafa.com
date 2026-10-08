import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { quranMarkdownValidator } from "@repo/backend/content/quran/contract";
import { readQuranMarkdown } from "@repo/backend/content/quran/markdown";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranLocaleSources,
  makeQuranMeaning,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect, Schema } from "effect";

const encodeMarkdown = Schema.encodeSync(
  Schema.fromJsonString(quranMarkdownValidator),
  { onExcessProperty: "error" }
);

describe("contentRelease/quran/markdown", () => {
  it.effect("returns a normalized unmanaged markdown projection", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const _tCtx = yield* MutationCtx;
          expect(
            yield* readQuranMarkdown("id", 1).pipe(Effect.provide(quranLayer))
          ).toMatchObject({
            appLocale: "id",
            managed: false,
            surah: null,
            tafsirAccess: null,
            toVerse: 0,
            verses: [],
          });
        })
      );
    })
  );
  it.effect("projects only app-locale fields rendered in markdown", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [
              makeQuranAttribution(),
              makeQuranSurah(1),
              makeQuranChunk({
                firstQuranNumber: 1,
                firstVerse: 1,
                surahNumber: 1,
                verseCount: 1,
              }),
            ])
          );
          const markdown = yield* readQuranMarkdown("en", 1).pipe(
            Effect.provide(quranLayer)
          );
          expect(markdown.surah).toEqual({
            name: {
              arabic: "سورة 1",
              sourceMeaning: makeQuranMeaning(1),
              transliteration: "Technical Surah 1",
            },
            number: 1,
            numberOfVerses: 1,
            revelation: {
              place: "Meccan",
            },
          });
          expect(markdown.toVerse).toBe(1);
          expect(markdown.sources).toEqual(makeQuranLocaleSources("en"));
          expect(markdown.tafsirAccess).toEqual(
            makeQuranTafsirProjection("en")
          );
          expect(markdown.verses).toEqual([
            {
              arabic: "آية 1",
              number: {
                inSurah: 1,
              },
              translation: {
                notes: [],
                segments: [
                  {
                    kind: "text",
                    offset: 0,
                    value: "Technical translation 1",
                  },
                ],
              },
            },
          ]);
          expect(encodeMarkdown(markdown)).not.toContain("Terjemahan teknis");
          expect(encodeMarkdown(markdown)).not.toContain("Tafsir teknis");
          expect(encodeMarkdown(markdown)).not.toContain("inQuran");
        })
      );
    })
  );
  it.effect("reads only the requested signed verse prefix", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const numberOfVerses = 82;
          const bismillah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
          const chunks = Array.from(
            {
              length: Math.ceil(numberOfVerses / 6),
            },
            (_, index) => {
              const firstVerse = index * 6 + 1;
              return makeQuranChunk({
                ...(index === 0
                  ? {
                      arabicText: `${bismillah} آية ${firstVerse}`,
                    }
                  : {}),
                firstQuranNumber: firstVerse + 1,
                firstVerse,
                surahNumber: 2,
                verseCount: Math.min(6, numberOfVerses - firstVerse + 1),
              });
            }
          );
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [
              makeQuranAttribution(),
              makeQuranSurah(1),
              makeQuranSurah(2, numberOfVerses),
              makeQuranChunk({
                arabicText: bismillah,
                firstQuranNumber: 1,
                firstVerse: 1,
                surahNumber: 1,
                verseCount: 1,
              }),
              ...chunks,
            ])
          );
          const markdown = yield* readQuranMarkdown("id", 2, 80).pipe(
            Effect.provide(quranLayer)
          );
          expect(markdown.toVerse).toBe(80);
          expect(markdown.verses).toHaveLength(80);
          expect(markdown.preBismillah?.arabic).toBe(bismillah);
          expect(markdown.surah?.name.sourceMeaning).toEqual(
            makeQuranMeaning(2)
          );
          expect(markdown.verses[0]?.arabic).toBe("آية 1");
          expect(markdown.verses.at(-1)?.number.inSurah).toBe(80);
        })
      );
    })
  );
  it.effect("rejects an invalid verse limit before reading signed state", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const _tCtx = yield* MutationCtx;
          expect(
            yield* readQuranMarkdown("id", 1, 0).pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INVALID_REQUEST",
          });
        })
      );
    })
  );
});
