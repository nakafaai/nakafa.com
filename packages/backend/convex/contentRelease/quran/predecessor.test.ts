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

describe("contentRelease/quran predecessor compatibility", () => {
  it("keeps predecessor query shapes exact beside richer canonical queries", async () => {
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

    const [
      documentPredecessor,
      documentCanonical,
      markdownPredecessor,
      markdownCanonical,
    ] = await Promise.all([
      t.query(api.contentRelease.quran.document, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.surah, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.markdown, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.prose, {
        appLocale: "id",
        surahNumber: 1,
      }),
    ]);
    const [
      viewPredecessor,
      viewCanonical,
      referencePredecessor,
      referenceCanonical,
    ] = await Promise.all([
      t.query(api.contentRelease.quran.view, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.page, {
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
    const [interpretationPredecessor, interpretationCanonical] =
      await Promise.all([
        t.query(api.contentRelease.quran.interpretation, {
          appLocale: "id",
          expectedSnapshotId: snapshotId,
          surahNumber: 1,
          verseNumber: 1,
        }),
        t.query(api.contentRelease.quran.tafsir, {
          appLocale: "id",
          expectedSnapshotId: snapshotId,
          surahNumber: 1,
          verseNumber: 1,
        }),
      ]);

    expect(Object.keys(documentPredecessor).sort()).toEqual(
      [...sourceKeys, "appLocale", "surah", "verses"].sort()
    );
    expect(Object.keys(documentPredecessor.verses[0] ?? {}).sort()).toEqual([
      "arabic",
      "number",
      "translation",
    ]);
    expect(documentCanonical).toMatchObject({ sources: {}, tafsirAccess: {} });
    expect(documentCanonical.verses[0]?.translation).toMatchObject({
      notes: [],
      segments: {},
    });
    expect(Object.keys(documentCanonical.verses[0] ?? {})).not.toContain(
      "translationDocument"
    );

    expect(Object.keys(markdownPredecessor).sort()).toEqual(
      [
        ...sourceKeys,
        "appLocale",
        "surah",
        "tafsirAccess",
        "toVerse",
        "verses",
      ].sort()
    );
    expect(Object.keys(markdownPredecessor.verses[0] ?? {})).not.toContain(
      "translationDocument"
    );
    expect(markdownCanonical).toMatchObject({ sources: {}, tafsirAccess: {} });
    expect(Object.keys(markdownCanonical.verses[0] ?? {})).not.toContain(
      "translationDocument"
    );

    expect(Object.keys(viewPredecessor).sort()).toEqual(
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
    expect(viewPredecessor.surah?.name).toEqual({
      translation: "Technical meaning 1",
      transliteration: "Technical Surah 1",
    });
    expect(viewCanonical.surah?.name).toMatchObject({ meaning: null });
    expect(viewCanonical).toMatchObject({ sources: {}, tafsirAccess: {} });
    expect(Object.keys(viewCanonical.verses[0] ?? {})).not.toContain(
      "translationFootnotes"
    );

    expect(Object.keys(referencePredecessor).sort()).toEqual(
      [
        ...sourceKeys,
        "chunkJson",
        "fromVerse",
        "searchJson",
        "surahJson",
        "toVerse",
      ].sort()
    );
    expect(referenceCanonical).toMatchObject({ sources: {}, tafsirAccess: {} });

    expect(Object.keys(interpretationPredecessor).sort()).toEqual(
      [
        ...sourceKeys,
        "appLocale",
        "interpretation",
        "surahNumber",
        "verseNumber",
      ].sort()
    );
    expect(interpretationCanonical).toMatchObject({
      interpretation: "Tafsir teknis 1",
      tafsirAccess: { appLocale: "id", kind: "embedded" },
    });
  });
});
