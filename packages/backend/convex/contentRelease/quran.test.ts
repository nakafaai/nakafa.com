import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  activateQuranSource,
} from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const bismillah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

function expansionRows() {
  return [
    makeQuranAttribution(),
    makeQuranSurah(1),
    makeQuranSurah(2, 2),
    makeQuranSurah(3),
    makeQuranChunk({
      arabicText: bismillah,
      firstQuranNumber: 1,
      firstVerse: 1,
      surahNumber: 1,
      translationFootnotes: {
        id: "[4] Catatan teknis Bismillah Indonesia.",
      },
      translationText: { id: "Terjemahan teknis 1[4]" },
      verseCount: 1,
    }),
    makeQuranChunk({
      arabicText: `${bismillah} الٓمٓ`,
      firstQuranNumber: 2,
      firstVerse: 1,
      surahNumber: 2,
      verseCount: 2,
    }),
    makeQuranSearch("id", 2),
  ];
}

describe("contentRelease/quran", () => {
  it("registers semantic queries before consumers switch", async () => {
    const t = convexTest(schema, convexModules);

    const [surah, prose, page, passage] = await Promise.all([
      t.query(api.contentRelease.quran.surah, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.prose, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.page, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.passage, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 2,
      }),
    ]);

    for (const result of [surah, prose, page, passage]) {
      expect(result).toMatchObject({ managed: false, preBismillah: null });
    }
    await expect(
      t.query(api.contentRelease.quran.tafsir, {
        appLocale: "id",
        expectedSnapshotId: `sha256:${"0".repeat(64)}`,
        surahNumber: 2,
        verseNumber: 1,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("preserves prior responses while semantic queries separate Bismillah", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateQuranSnapshot(ctx, expansionRows()));

    const [
      documentV2,
      surah,
      markdownV2,
      prose,
      viewV2,
      page,
      referenceV2,
      passage,
    ] = await Promise.all([
      t.query(api.contentRelease.quran.documentV2, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.surah, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.markdownV2, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.prose, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.viewV2, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.page, {
        appLocale: "id",
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.referenceV2, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 2,
      }),
      t.query(api.contentRelease.quran.passage, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 2,
      }),
    ]);

    for (const result of [documentV2, markdownV2, viewV2]) {
      expect(result).not.toHaveProperty("preBismillah");
      expect(result.verses[0]?.arabic).toBe(`${bismillah} الٓمٓ`);
    }
    expect(referenceV2).not.toHaveProperty("preBismillah");
    for (const result of [surah, prose, page, passage]) {
      expect(result.preBismillah).toEqual({
        arabic: bismillah,
        translation: {
          notes: [
            {
              number: 4,
              referenceOffset: 19,
              text: "Catatan teknis Bismillah Indonesia.",
            },
          ],
          segments: [
            { kind: "text", offset: 0, value: "Terjemahan teknis 1" },
            { kind: "note", number: 4, offset: 19 },
          ],
        },
      });
    }
    expect(surah.verses[0]?.arabic).toBe("الٓمٓ");
    expect(prose.verses[0]?.arabic).toBe("الٓمٓ");
    expect(page.verses[0]?.arabic).toBe("الٓمٓ");
  });

  it("registers public reads and rejects a stale interpretation", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(api.contentRelease.quran.attribution, {})
    ).resolves.toMatchObject({ managed: false, rowJson: null });
    await expect(
      t.query(api.contentRelease.quran.surahs, {})
    ).resolves.toMatchObject({ managed: false, rowJson: [] });
    await expect(
      t.query(api.contentRelease.quran.document, {
        appLocale: "en",
        surahNumber: 1,
      })
    ).resolves.toMatchObject({ managed: false, surah: null, verses: [] });
    await expect(
      t.query(api.contentRelease.quran.markdown, {
        appLocale: "id",
        surahNumber: 1,
      })
    ).resolves.toMatchObject({ managed: false, surah: null, verses: [] });
    await expect(
      t.query(api.contentRelease.quran.view, {
        appLocale: "id",
        surahNumber: 1,
      })
    ).resolves.toMatchObject({ managed: false, surah: null, verses: [] });
    await expect(
      t.query(api.contentRelease.quran.interpretation, {
        appLocale: "id",
        expectedSnapshotId: `sha256:${"0".repeat(64)}`,
        surahNumber: 1,
        verseNumber: 1,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
    await expect(
      t.query(api.contentRelease.quran.reference, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 1,
      })
    ).resolves.toMatchObject({ fromVerse: 1, managed: false, toVerse: 1 });
  });

  it("pins every unmanaged read to the active source release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(activateQuranSource);
    const results = await Promise.all([
      t.query(api.contentRelease.quran.attribution, {}),
      t.query(api.contentRelease.quran.surahs, {}),
      t.query(api.contentRelease.quran.document, {
        appLocale: "en",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.markdown, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.view, {
        appLocale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.reference, {
        appLocale: "id",
        fromVerse: 1,
        surahNumber: 1,
      }),
    ]);

    for (const result of results) {
      expect(result).toMatchObject({
        activeManifestHash: TEST_MANIFEST_HASH,
        activeReleaseId: TEST_RELEASE_ID,
        managed: false,
        snapshotId: null,
        sourceOrigin: null,
        sourceRevision: null,
      });
    }
    await expect(
      t.query(api.contentRelease.quran.interpretation, {
        appLocale: "id",
        expectedSnapshotId: `sha256:${"0".repeat(64)}`,
        surahNumber: 1,
        verseNumber: 1,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });
});
