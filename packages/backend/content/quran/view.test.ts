import { describe, expect, it } from "@effect/vitest";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import { readQuranView } from "@repo/backend/content/quran/view";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
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
import { convexTest } from "convex-test";
import { Effect } from "effect";

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
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          activateQuranSnapshot(ctx, [makeQuranAttribution()])
        )
      );
      yield* Effect.promise(() =>
        expect(
          t.query((ctx) =>
            runConvexProgram(
              readQuranView("en", 1).pipe(Effect.provide(convexQuranLayer(ctx)))
            )
          )
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
            message: expect.stringContaining("surah:1"),
          },
        })
      );
    })
  );

  it.effect(
    "ends navigation at the final surah and preserves its signed Bismillah",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const arabic = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateQuranSnapshot(ctx, [
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
          )
        );
        const view = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readQuranView("de", 114).pipe(
                Effect.provide(convexQuranLayer(ctx))
              )
            )
          )
        );
        expect(view.nextSurah).toBeNull();
        expect(view.previousSurah?.number).toBe(113);
        expect(view.preBismillah?.arabic).toBe(arabic);
        expect(view.verses[0]?.arabic).toBe("النَّاسِ");
      })
  );

  it.effect(
    "rejects a signed opening verse that does not carry its Bismillah prefix",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            activateQuranSnapshot(ctx, [
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
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readQuranView("id", 2).pipe(
                  Effect.provide(convexQuranLayer(ctx))
                )
              )
            )
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
              message: expect.stringContaining("Bismillah prefix"),
            },
          })
        );
      })
  );

  it("returns normalized unmanaged app-locale views", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranView("en", 1).pipe(Effect.provide(convexQuranLayer(ctx)))
        )
      )
    ).resolves.toEqual({
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
  });

  it("separates the signed Bismillah before Al-Baqarah verse 1", async () => {
    const t = convexTest(schema, convexModules);
    const arabic = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
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

    const view = await t.query((ctx) =>
      runConvexProgram(
        readQuranView("id", 2).pipe(Effect.provide(convexQuranLayer(ctx)))
      )
    );

    expect(view.preBismillah).toEqual({
      arabic,
      translation: {
        notes: [],
        segments: [{ kind: "text", offset: 0, value: "Terjemahan teknis 1" }],
      },
    });
    expect(view.verses[0]?.arabic).toBe("الٓمٓ");
  });

  it("projects only the requested app locale without transporting tafsir bodies", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateQuranSnapshot(ctx, viewRows()));

    const english = await t.query((ctx) =>
      runConvexProgram(
        readQuranView("en", 1).pipe(Effect.provide(convexQuranLayer(ctx)))
      )
    );
    const indonesian = await t.query((ctx) =>
      runConvexProgram(
        readQuranView("id", 1).pipe(Effect.provide(convexQuranLayer(ctx)))
      )
    );

    expect(english.nextSurah).toEqual({
      name: {
        sourceMeaning: makeQuranMeaning(2),
        transliteration: "Technical Surah 2",
      },
      number: 2,
      numberOfVerses: 1,
    });
    expect(english.previousSurah).toBeNull();
    expect(english.surah).toEqual({
      name: {
        sourceMeaning: makeQuranMeaning(1),
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 1,
    });
    expect(english.sources).toEqual(makeQuranLocaleSources("en"));
    expect(english.tafsirAccess).toEqual(makeQuranTafsirProjection("en"));
    expect(english.verses).toEqual([
      {
        arabic: "آية 1",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [
            {
              number: 1,
              referenceOffset: 23,
              text: "Technical English translation note.",
            },
          ],
          segments: [
            { kind: "text", offset: 0, value: "Technical translation 1" },
            { kind: "note", number: 1, offset: 23 },
          ],
        },
      },
    ]);
    expect(indonesian.verses).toEqual([
      {
        arabic: "آية 1",
        number: { inQuran: 1, inSurah: 1 },
        translation: {
          notes: [
            {
              number: 4,
              referenceOffset: 19,
              text: "Catatan teknis terjemahan Indonesia.",
            },
          ],
          segments: [
            { kind: "text", offset: 0, value: "Terjemahan teknis 1" },
            { kind: "note", number: 4, offset: 19 },
          ],
        },
      },
    ]);
    expect(indonesian.sources).toEqual(makeQuranLocaleSources("id"));
    expect(indonesian.tafsirAccess).toEqual(makeQuranTafsirProjection("id"));
    expect(indonesian.nextSurah?.name.sourceMeaning).toEqual(
      makeQuranMeaning(2)
    );
    expect(indonesian.surah?.name.sourceMeaning).toEqual(makeQuranMeaning(1));
    expect(JSON.stringify(indonesian)).not.toContain("Tafsir teknis");
    expect({
      english: english.appLocale,
      indonesian: indonesian.appLocale,
    }).toEqual({ english: "en", indonesian: "id" });
  });

  it("does not read the unrelated signed search projection", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        viewRows().filter((row) => row.kind !== "quran-search")
      )
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranView("id", 1).pipe(Effect.provide(convexQuranLayer(ctx)))
        )
      )
    ).resolves.toMatchObject({
      snapshotId,
      verses: [
        {
          number: { inQuran: 1, inSurah: 1 },
          translation: {
            notes: [
              {
                number: 4,
                referenceOffset: 19,
                text: "Catatan teknis terjemahan Indonesia.",
              },
            ],
            segments: [
              { kind: "text", offset: 0, value: "Terjemahan teknis 1" },
              { kind: "note", number: 4, offset: 19 },
            ],
          },
        },
      ],
    });
  });
});
