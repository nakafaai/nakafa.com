import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { activateQuranSource } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/quran", () => {
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
