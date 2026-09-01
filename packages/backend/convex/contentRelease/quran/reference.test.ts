import { describe, expect, it } from "@effect/vitest";
import { readQuranPassage } from "@repo/backend/convex/contentRelease/quran/reference";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
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

/** Creates two chunks and their signed metadata for one seven-verse surah. */
function referenceRows() {
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
    makeQuranSearch("en", 1),
  ];
}

describe("contentRelease/quran/reference", () => {
  it("returns a normalized unmanaged range before Quran activation", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranPassage(ctx, {
            fromVerse: 2,
            appLocale: "en",
            surahNumber: 1,
          })
        )
      )
    ).resolves.toMatchObject({
      fromVerse: 2,
      managed: false,
      toVerse: 2,
    });
  });

  it("returns only the signed chunks covering one localized range", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, referenceRows())
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranPassage(ctx, {
            fromVerse: 6,
            appLocale: "en",
            surahNumber: 1,
            toVerse: 7,
          })
        )
      )
    ).resolves.toMatchObject({
      chunkJson: [expect.any(String), expect.any(String)],
      fromVerse: 6,
      managed: true,
      searchJson: expect.any(String),
      snapshotId,
      surahJson: expect.any(String),
      toVerse: 7,
    });
  });

  it("rejects references beyond the signed surah boundary", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateQuranSnapshot(ctx, referenceRows()));

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranPassage(ctx, {
            fromVerse: 7,
            appLocale: "en",
            surahNumber: 1,
            toVerse: 8,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
  });

  it("rejects a surah that exceeds the bounded page contract", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSurah(1, 301)])
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranPassage(ctx, {
            fromVerse: 1,
            appLocale: "en",
            surahNumber: 1,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("requires the signed search row used by public references", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        referenceRows().filter((row) => row.kind !== "quran-search")
      )
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranPassage(ctx, {
            fromVerse: 1,
            appLocale: "en",
            surahNumber: 1,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
