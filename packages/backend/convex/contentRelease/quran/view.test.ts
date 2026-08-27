import { readQuranView } from "@repo/backend/convex/contentRelease/quran/view";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranLocaleSources,
  makeQuranSearch,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

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
  it("returns normalized unmanaged app-locale views", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readQuranView(ctx, "en", 1)))
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
      runConvexProgram(readQuranView(ctx, "id", 2))
    );

    expect(view.preBismillah).toEqual({
      arabic,
      translation: "Terjemahan teknis 1",
    });
    expect(view.verses[0]?.arabic).toBe("الٓمٓ");
  });

  it("projects only the requested app locale without transporting tafsir bodies", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateQuranSnapshot(ctx, viewRows()));

    const english = await t.query((ctx) =>
      runConvexProgram(readQuranView(ctx, "en", 1))
    );
    const indonesian = await t.query((ctx) =>
      runConvexProgram(readQuranView(ctx, "id", 1))
    );

    expect(english.nextSurah).toEqual({
      name: {
        meaning: "Technical meaning 2",
        transliteration: "Technical Surah 2",
      },
      number: 2,
      numberOfVerses: 1,
    });
    expect(english.previousSurah).toBeNull();
    expect(english.surah).toEqual({
      name: {
        meaning: "Technical meaning 1",
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
      t.query((ctx) => runConvexProgram(readQuranView(ctx, "id", 1)))
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
