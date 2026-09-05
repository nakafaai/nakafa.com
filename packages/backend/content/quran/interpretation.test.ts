import { describe, expect, it } from "@effect/vitest";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import { readQuranInterpretation } from "@repo/backend/content/quran/interpretation";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  restoreAbsentQuranSnapshot,
} from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Creates only the signed rows required to read verse seven. */
function interpretationRows() {
  return [
    makeQuranAttribution(),
    makeQuranSurah(1, 7),
    makeQuranChunk({
      firstQuranNumber: 7,
      firstVerse: 7,
      surahNumber: 1,
      verseCount: 1,
    }),
    makeQuranSearch("id", 1),
  ];
}

const expectedSnapshotId = `sha256:${"0".repeat(64)}`;

describe("contentRelease/quran/interpretation", () => {
  it("rejects a stale click when Quran has no active snapshot", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranInterpretation("id", expectedSnapshotId, 1, 7).pipe(
            Effect.provide(convexQuranLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("returns only the requested tafsir from its signed chunk", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, interpretationRows())
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranInterpretation("id", snapshotId, 1, 7).pipe(
            Effect.provide(convexQuranLayer(ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      appLocale: "id",
      interpretation: "Tafsir teknis 7",
      managed: true,
      snapshotId,
      surahNumber: 1,
      verseNumber: 7,
    });
  });

  it("rejects requests beyond the signed surah boundary", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, interpretationRows())
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranInterpretation("id", snapshotId, 1, 8).pipe(
            Effect.provide(convexQuranLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
  });

  it("rejects a click from a superseded signed snapshot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateQuranSnapshot(ctx, interpretationRows()));

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranInterpretation("id", expectedSnapshotId, 1, 7).pipe(
            Effect.provide(convexQuranLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("rejects a click after recovery restores the absent snapshot", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, interpretationRows())
    );
    await t.mutation((ctx) => restoreAbsentQuranSnapshot(ctx, snapshotId));

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranInterpretation("id", snapshotId, 1, 7).pipe(
            Effect.provide(convexQuranLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("does not read the unrelated signed search projection", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        interpretationRows().filter((row) => row.kind !== "quran-search")
      )
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readQuranInterpretation("id", snapshotId, 1, 7).pipe(
            Effect.provide(convexQuranLayer(ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      interpretation: "Tafsir teknis 7",
      snapshotId,
      verseNumber: 7,
    });
  });
});
