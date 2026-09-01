import { describe, expect, it } from "@effect/vitest";
import { readQuranChunks } from "@repo/backend/convex/contentRelease/quran/chunks";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranChunk } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";

const firstChunk = makeQuranChunk({
  firstQuranNumber: 1,
  firstVerse: 1,
  surahNumber: 1,
  verseCount: 6,
});
const secondChunk = makeQuranChunk({
  firstQuranNumber: 7,
  firstVerse: 7,
  surahNumber: 1,
  verseCount: 1,
});

describe("contentRelease/quran/chunks", () => {
  it("reads only the coherent chunks covering one requested range", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [firstChunk, secondChunk])
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranChunks(ctx, {
            fromVerse: 2,
            numberOfVerses: 7,
            snapshotId,
            surahNumber: 1,
            toVerse: 7,
          })
        )
      )
    ).resolves.toMatchObject({
      rowJson: [expect.any(String), expect.any(String)],
      rows: [{ firstVerse: 1 }, { firstVerse: 7 }],
    });
  });

  it("fails closed for missing, discontinuous, or excessive chunks", async () => {
    const missing = convexTest(schema, convexModules);
    const missingId = await missing.mutation((ctx) =>
      activateQuranSnapshot(ctx, [firstChunk])
    );
    await expect(
      missing.query((ctx) =>
        runConvexProgram(
          readQuranChunks(ctx, {
            fromVerse: 1,
            numberOfVerses: 7,
            snapshotId: missingId,
            surahNumber: 1,
            toVerse: 7,
          })
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const discontinuous = convexTest(schema, convexModules);
    const changedSecond = makeQuranChunk({
      firstQuranNumber: 8,
      firstVerse: 7,
      surahNumber: 1,
      verseCount: 1,
    });
    const changedId = await discontinuous.mutation((ctx) =>
      activateQuranSnapshot(ctx, [firstChunk, changedSecond])
    );
    await expect(
      discontinuous.query((ctx) =>
        runConvexProgram(
          readQuranChunks(ctx, {
            fromVerse: 1,
            numberOfVerses: 7,
            snapshotId: changedId,
            surahNumber: 1,
            toVerse: 7,
          })
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const excessive = convexTest(schema, convexModules);
    await expect(
      excessive.query((ctx) =>
        runConvexProgram(
          readQuranChunks(ctx, {
            fromVerse: 1,
            numberOfVerses: 301,
            snapshotId: "technical-snapshot",
            surahNumber: 1,
            toVerse: 301,
          })
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });
  });
});
