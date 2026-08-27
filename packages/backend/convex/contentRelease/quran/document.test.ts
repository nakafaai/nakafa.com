import { readQuranDocument } from "@repo/backend/convex/contentRelease/quran/document";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranLocaleSources,
  makeQuranSurah,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

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
  it("returns a normalized unmanaged document", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readQuranDocument(ctx, "en", 1)))
    ).resolves.toEqual({
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
  });

  it("projects metadata, footnotes, and only the requested app locale", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateQuranSnapshot(ctx, documentRows()));

    const document = await t.query((ctx) =>
      runConvexProgram(readQuranDocument(ctx, "id", 1))
    );

    expect(document.sources).toEqual(makeQuranLocaleSources("id"));
    expect(document.tafsirAccess).toEqual(makeQuranTafsirProjection("id"));
    expect(document.surah).toEqual({
      kind: "quran-surah",
      name: {
        arabic: "سورة 1",
        meaning: null,
        sourceMeaning: { appLocale: "en", text: "Technical meaning 1" },
        transliteration: "Technical Surah 1",
      },
      number: 1,
      numberOfVerses: 7,
      revelation: { order: 1, place: "Meccan" },
    });
    expect(document.verses[0]).toEqual({
      arabic: "آية 1",
      number: { inQuran: 1, inSurah: 1 },
      translation: {
        notes: [],
        segments: [{ kind: "text", offset: 0, value: "Terjemahan teknis 1" }],
      },
    });
    expect(document.verses).toHaveLength(7);
    expect(JSON.stringify(document)).not.toContain("Technical translation");
    expect(JSON.stringify(document)).not.toContain("Tafsir teknis");
    expect(JSON.stringify(document)).not.toContain("hizbQuarter");
  });

  it("projects the complete signed German translation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateQuranSnapshot(ctx, documentRows()));

    const german = await t.query((ctx) =>
      runConvexProgram(readQuranDocument(ctx, "de", 1))
    );
    expect(german).toMatchObject({
      appLocale: "de",
      sources: makeQuranLocaleSources("de"),
      surah: {
        name: {
          meaning: null,
          sourceMeaning: { appLocale: "en", text: "Technical meaning 1" },
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
  });

  it("rejects invalid, oversized, and incomplete signed documents", async () => {
    const invalid = convexTest(schema, convexModules);
    await expect(
      invalid.query((ctx) => runConvexProgram(readQuranDocument(ctx, "en", 0)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });

    const oversized = convexTest(schema, convexModules);
    await oversized.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSurah(1, 301)])
    );
    await expect(
      oversized.query((ctx) =>
        runConvexProgram(readQuranDocument(ctx, "en", 1))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });

    const incomplete = convexTest(schema, convexModules);
    await incomplete.mutation((ctx) =>
      activateQuranSnapshot(ctx, documentRows().slice(0, -1))
    );
    await expect(
      incomplete.query((ctx) =>
        runConvexProgram(readQuranDocument(ctx, "en", 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
