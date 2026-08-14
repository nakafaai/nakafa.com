import { readQuranView } from "@repo/backend/convex/contentRelease/quran/view";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Builds every verified source row needed by the first Quran page. */
function viewRows() {
  return [
    makeQuranSurah(1),
    makeQuranSurah(2),
    makeQuranChunk({
      firstQuranNumber: 1,
      firstVerse: 1,
      surahNumber: 1,
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
      previousSurah: null,
      snapshotId: null,
      sourceRevision: null,
      surah: null,
      verses: [],
    });
  });

  it("projects only the requested app locale without transporting tafsir", async () => {
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
        translation: "Technical meaning 2",
        transliteration: "Technical Surah 2",
      },
      number: 2,
      numberOfVerses: 1,
    });
    expect(english.previousSurah).toBeNull();
    expect(english.surah).toEqual({
      name: {
        translation: "Technical meaning 1",
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 1,
    });
    expect(english.verses).toEqual([
      {
        arabic: "آية 1",
        number: { inQuran: 1, inSurah: 1 },
        translation: "Technical translation 1",
      },
    ]);
    expect(indonesian.verses).toEqual([
      {
        arabic: "آية 1",
        number: { inQuran: 1, inSurah: 1 },
        translation: "Terjemahan teknis 1",
      },
    ]);
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
          translation: "Terjemahan teknis 1",
        },
      ],
    });
  });
});
