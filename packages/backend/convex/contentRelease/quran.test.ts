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
  it("registers every bounded public read with normalized unmanaged output", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(api.contentRelease.quran.attribution, {})
    ).resolves.toMatchObject({ managed: false, rowJson: null });
    await expect(
      t.query(api.contentRelease.quran.surahs, {})
    ).resolves.toMatchObject({ managed: false, rowJson: [] });
    await expect(
      t.query(api.contentRelease.quran.page, {
        locale: "en",
        surahNumber: 1,
      })
    ).resolves.toMatchObject({ managed: false, surahJson: null });
    await expect(
      t.query(api.contentRelease.quran.view, {
        locale: "id",
        surahNumber: 1,
      })
    ).resolves.toMatchObject({ managed: false, surah: null, verses: [] });
    await expect(
      t.query(api.contentRelease.quran.interpretation, {
        expectedSnapshotId: `sha256:${"0".repeat(64)}`,
        locale: "id",
        surahNumber: 1,
        verseNumber: 1,
      })
    ).resolves.toMatchObject({ interpretation: null, managed: false });
    await expect(
      t.query(api.contentRelease.quran.reference, {
        fromVerse: 1,
        locale: "id",
        surahNumber: 1,
      })
    ).resolves.toMatchObject({ fromVerse: 1, managed: false, toVerse: 1 });
    await expect(
      t.query(api.contentRelease.quran.search, {
        locale: "id",
        query: "technical",
      })
    ).resolves.toMatchObject({ managed: false, rowJson: [] });
    await expect(
      t.query(api.contentRelease.quran.sitemap, { locale: "en" })
    ).resolves.toEqual({
      activeManifestHash: null,
      activeReleaseId: null,
      locale: "en",
      managed: false,
      routes: [],
      snapshotId: null,
      sourceRevision: null,
    });
  });

  it("pins every unmanaged read to the active source release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(activateQuranSource);
    const results = await Promise.all([
      t.query(api.contentRelease.quran.attribution, {}),
      t.query(api.contentRelease.quran.surahs, {}),
      t.query(api.contentRelease.quran.page, {
        locale: "en",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.view, {
        locale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.interpretation, {
        expectedSnapshotId: `sha256:${"0".repeat(64)}`,
        locale: "id",
        surahNumber: 1,
        verseNumber: 1,
      }),
      t.query(api.contentRelease.quran.reference, {
        fromVerse: 1,
        locale: "id",
        surahNumber: 1,
      }),
      t.query(api.contentRelease.quran.search, {
        locale: "id",
        query: "technical",
      }),
      t.query(api.contentRelease.quran.sitemap, { locale: "en" }),
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
  });
});
