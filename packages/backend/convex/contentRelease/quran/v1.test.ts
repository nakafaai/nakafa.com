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

describe("contentRelease/quran V1 compatibility", () => {
  it("keeps predecessor query shapes exact beside richer V2 queries", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        makeQuranSurah(1),
        makeQuranSurah(2),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 1,
        }),
        makeQuranSearch("id", 1),
      ])
    );

    const [documentV1, documentV2, markdownV1, markdownV2] = await Promise.all([
      t.query(api.contentRelease.quran.document, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.documentV2, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.markdown, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.markdownV2, {
        appLocale: "id",
        surahNumber: 1,
      }),
    ]);
    const [viewV1, viewV2, referenceV1, referenceV2] = await Promise.all([
      t.query(api.contentRelease.quran.view, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.viewV2, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.reference, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.referenceV2, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 1,
      }),
    ]);
    const [interpretationV1, interpretationV2] = await Promise.all([
      t.query(api.contentRelease.quran.interpretation, {
        appLocale: "id",
        expectedSnapshotId: snapshotId,
        surahNumber: 1,
        verseNumber: 1,
      }),
      t.query(api.contentRelease.quran.interpretationV2, {
        appLocale: "id",
        expectedSnapshotId: snapshotId,
        surahNumber: 1,
        verseNumber: 1,
      }),
    ]);

    expect(Object.keys(documentV1).sort()).toEqual(
      [...sourceKeys, "appLocale", "surah", "verses"].sort()
    );
    expect(Object.keys(documentV1.verses[0] ?? {}).sort()).toEqual([
      "arabic",
      "number",
      "translation",
    ]);
    expect(documentV2).toMatchObject({ sources: {}, tafsirAccess: {} });
    expect(documentV2.verses[0]?.translation).toMatchObject({
      notes: [],
      segments: {},
    });
    expect(Object.keys(documentV2.verses[0] ?? {})).not.toContain(
      "translationDocument"
    );

    expect(Object.keys(markdownV1).sort()).toEqual(
      [
        ...sourceKeys,
        "appLocale",
        "surah",
        "tafsirAccess",
        "toVerse",
        "verses",
      ].sort()
    );
    expect(Object.keys(markdownV1.verses[0] ?? {})).not.toContain(
      "translationDocument"
    );
    expect(markdownV2).toMatchObject({ sources: {}, tafsirAccess: {} });
    expect(Object.keys(markdownV2.verses[0] ?? {})).not.toContain(
      "translationDocument"
    );

    expect(Object.keys(viewV1).sort()).toEqual(
      [
        ...sourceKeys,
        "appLocale",
        "nextSurah",
        "previousSurah",
        "surah",
        "tafsirAccess",
        "verses",
      ].sort()
    );
    expect(viewV1.surah?.name).toEqual({
      translation: "Technical meaning 1",
      transliteration: "Technical Surah 1",
    });
    expect(viewV2.surah?.name).toMatchObject({ meaning: null });
    expect(viewV2).toMatchObject({ sources: {}, tafsirAccess: {} });
    expect(Object.keys(viewV2.verses[0] ?? {})).not.toContain(
      "translationFootnotes"
    );

    expect(Object.keys(referenceV1).sort()).toEqual(
      [
        ...sourceKeys,
        "chunkJson",
        "fromVerse",
        "searchJson",
        "surahJson",
        "toVerse",
      ].sort()
    );
    expect(referenceV2).toMatchObject({ sources: {}, tafsirAccess: {} });

    expect(Object.keys(interpretationV1).sort()).toEqual(
      [
        ...sourceKeys,
        "appLocale",
        "interpretation",
        "surahNumber",
        "verseNumber",
      ].sort()
    );
    expect(interpretationV2).toMatchObject({
      interpretation: "Tafsir teknis 1",
      tafsirAccess: { appLocale: "id", kind: "embedded" },
    });
  });
});
