import { describe, expect, it } from "@effect/vitest";
import { readQuranMarkdown } from "@repo/backend/convex/contentRelease/quran/markdown";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranLocaleSources,
  makeQuranMeaning,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";

describe("contentRelease/quran/markdown", () => {
  it("returns a normalized unmanaged markdown projection", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readQuranMarkdown(ctx, "id", 1)))
    ).resolves.toMatchObject({
      appLocale: "id",
      managed: false,
      surah: null,
      tafsirAccess: null,
      toVerse: 0,
      verses: [],
    });
  });

  it("projects only app-locale fields rendered in markdown", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
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

    const markdown = await t.query((ctx) =>
      runConvexProgram(readQuranMarkdown(ctx, "en", 1))
    );

    expect(markdown.surah).toEqual({
      name: {
        sourceMeaning: makeQuranMeaning(1),
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 1,
      revelation: { place: "Meccan" },
    });
    expect(markdown.toVerse).toBe(1);
    expect(markdown.sources).toEqual(makeQuranLocaleSources("en"));
    expect(markdown.tafsirAccess).toEqual(makeQuranTafsirProjection("en"));
    expect(markdown.verses).toEqual([
      {
        arabic: "آية 1",
        number: { inSurah: 1 },
        translation: {
          notes: [],
          segments: [
            { kind: "text", offset: 0, value: "Technical translation 1" },
          ],
        },
      },
    ]);
    expect(JSON.stringify(markdown)).not.toContain("Terjemahan teknis");
    expect(JSON.stringify(markdown)).not.toContain("Tafsir teknis");
    expect(JSON.stringify(markdown)).not.toContain("inQuran");
  });

  it("reads only the requested signed verse prefix", async () => {
    const t = convexTest(schema, convexModules);
    const numberOfVerses = 82;
    const bismillah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
    const chunks = Array.from(
      { length: Math.ceil(numberOfVerses / 6) },
      (_, index) => {
        const firstVerse = index * 6 + 1;
        return makeQuranChunk({
          ...(index === 0
            ? { arabicText: `${bismillah} آية ${firstVerse}` }
            : {}),
          firstQuranNumber: firstVerse + 1,
          firstVerse,
          surahNumber: 2,
          verseCount: Math.min(6, numberOfVerses - firstVerse + 1),
        });
      }
    );
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
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

    const markdown = await t.query((ctx) =>
      runConvexProgram(readQuranMarkdown(ctx, "id", 2, 80))
    );

    expect(markdown.toVerse).toBe(80);
    expect(markdown.verses).toHaveLength(80);
    expect(markdown.preBismillah?.arabic).toBe(bismillah);
    expect(markdown.surah?.name.sourceMeaning).toEqual(makeQuranMeaning(2));
    expect(markdown.verses[0]?.arabic).toBe("آية 1");
    expect(markdown.verses.at(-1)?.number.inSurah).toBe(80);
  });

  it("rejects an invalid verse limit before reading signed state", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readQuranMarkdown(ctx, "id", 1, 0)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
  });
});
