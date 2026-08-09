import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readQuranPage } from "@repo/backend/convex/contentRelease/quran/page";
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
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Builds the complete technical page rows for Quran surah one. */
function pageRows(numberOfVerses = 7) {
  const rows = [
    makeQuranSurah(1, numberOfVerses),
    makeQuranSurah(2),
    makeQuranChunk({
      firstQuranNumber: 1,
      firstVerse: 1,
      surahNumber: 1,
      verseCount: Math.min(numberOfVerses, 6),
    }),
    makeQuranSearch("id", 1),
  ];
  if (numberOfVerses > 6) {
    rows.push(
      makeQuranChunk({
        firstQuranNumber: 7,
        firstVerse: 7,
        surahNumber: 1,
        verseCount: Math.min(numberOfVerses - 6, 6),
      })
    );
  }
  return rows;
}

describe("contentRelease/quran/page", () => {
  it("returns unmanaged state before Quran activation", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.query((ctx) => runConvexProgram(readQuranPage(ctx, "id", 1)))
    ).resolves.toMatchObject({ managed: false, surahJson: null });
  });

  it("returns one complete localized page with adjacent metadata", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, pageRows())
    );
    const result = await t.query((ctx) =>
      runConvexProgram(readQuranPage(ctx, "id", 1))
    );
    const search = await Effect.runPromise(
      decodeSnapshotRowJson(result.searchJson ?? "")
    );

    expect(Object.keys(result).sort()).toEqual([
      "activeManifestHash",
      "activeReleaseId",
      "chunkJson",
      "managed",
      "nextSurahJson",
      "prevSurahJson",
      "searchJson",
      "snapshotId",
      "sourceRevision",
      "surahJson",
    ]);
    expect(result).toMatchObject({
      chunkJson: [expect.any(String), expect.any(String)],
      managed: true,
      nextSurahJson: expect.any(String),
      prevSurahJson: null,
      snapshotId,
      surahJson: expect.any(String),
    });
    expect(search).toMatchObject({
      record: { payload: { kind: "quran-search", locale: "id" } },
    });
  });

  it("rejects invalid requests, oversized surahs, and missing page rows", async () => {
    const invalid = convexTest(schema, convexModules);
    await expect(
      invalid.query((ctx) => runConvexProgram(readQuranPage(ctx, "en", 0)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });

    const oversized = convexTest(schema, convexModules);
    await oversized.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSurah(1, 301)])
    );
    await expect(
      oversized.query((ctx) => runConvexProgram(readQuranPage(ctx, "en", 1)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });

    const missing = convexTest(schema, convexModules);
    await missing.mutation((ctx) =>
      activateQuranSnapshot(ctx, pageRows().slice(0, -1))
    );
    await expect(
      missing.query((ctx) => runConvexProgram(readQuranPage(ctx, "id", 1)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
