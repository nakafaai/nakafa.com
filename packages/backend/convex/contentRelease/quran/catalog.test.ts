import { describe, expect, it } from "@effect/vitest";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readQuranSurahs } from "@repo/backend/convex/contentRelease/quran/catalog";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSurah } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Builds the complete technical surah catalog. */
function makeSurahCatalog() {
  return Array.from({ length: QURAN_SURAH_COUNT }, (_, index) =>
    makeQuranSurah(index + 1)
  );
}

describe("contentRelease/quran/catalog", () => {
  it("returns an unmanaged catalog before publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) => runConvexProgram(readQuranSurahs(ctx)))
    ).resolves.toMatchObject({ managed: false, rowJson: [] });
  });

  it.live("returns the complete verified catalog", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const snapshotId = yield* Effect.promise(() =>
        t.mutation((ctx) => activateQuranSnapshot(ctx, makeSurahCatalog()))
      );
      const catalog = yield* Effect.promise(() =>
        t.query((ctx) => runConvexProgram(readQuranSurahs(ctx)))
      );
      const first = yield* decodeSnapshotRowJson(catalog.rowJson[0] ?? "");

      expect(catalog).toMatchObject({ managed: true, snapshotId });
      expect(catalog.rowJson).toHaveLength(QURAN_SURAH_COUNT);
      expect(first).toMatchObject({
        family: "quran",
        record: { payload: { kind: "quran-surah", number: 1 } },
      });
    })
  );

  it("fails closed for incomplete or noncanonical catalogs", async () => {
    const incomplete = convexTest(schema, convexModules);
    await incomplete.mutation((ctx) =>
      activateQuranSnapshot(
        ctx,
        makeSurahCatalog().slice(0, QURAN_SURAH_COUNT - 1)
      )
    );
    await expect(
      incomplete.query((ctx) => runConvexProgram(readQuranSurahs(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const duplicate = convexTest(schema, convexModules);
    const rows = makeSurahCatalog();
    rows[QURAN_SURAH_COUNT - 1] = makeQuranSurah(QURAN_SURAH_COUNT - 1);
    await duplicate.mutation((ctx) => activateQuranSnapshot(ctx, rows));
    await expect(
      duplicate.query((ctx) => runConvexProgram(readQuranSurahs(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
