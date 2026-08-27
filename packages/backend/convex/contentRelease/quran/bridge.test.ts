import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const sourceKeys = [
  "activeManifestHash",
  "activeReleaseId",
  "managed",
  "snapshotId",
  "sourceOrigin",
  "sourceRevision",
];

describe("contentRelease/quran deployment bridge", () => {
  it("keeps already deployed document and reference shapes exact", async () => {
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
        makeQuranSearch("id", 1),
      ])
    );

    const [document, surah, reference, passage] = await Promise.all([
      t.query(api.contentRelease.quran.document, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.surah, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.reference, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.passage, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 1,
      }),
    ]);

    expect(Object.keys(document).sort()).toEqual(
      [...sourceKeys, "appLocale", "surah", "verses"].sort()
    );
    expect(document.surah?.name).toEqual({
      arabic: "سورة 1",
      translation: "Technical meaning 1",
      transliteration: "Technical Surah 1",
    });
    expect(document.verses[0]?.translation).toEqual({
      footnotes: "",
      text: "Terjemahan teknis 1",
    });
    expect(surah).toMatchObject({
      preBismillah: null,
      sources: {},
      tafsirAccess: {},
    });

    expect(Object.keys(reference).sort()).toEqual(
      [
        ...sourceKeys,
        "chunkJson",
        "fromVerse",
        "searchJson",
        "surahJson",
        "toVerse",
      ].sort()
    );
    expect(passage).toMatchObject({
      preBismillah: null,
      sources: {},
      tafsirAccess: {},
    });
  });
});
