import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { searchQuran } from "@repo/backend/convex/contentRelease/quran/search";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/quran/search", () => {
  it("returns unmanaged search results before Quran activation", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.query((ctx) => runConvexProgram(searchQuran(ctx, "en", "mercy")))
    ).resolves.toMatchObject({ managed: false, rowJson: [] });
  });

  it("searches only verified rows from the requested snapshot and locale", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSearch("en", 1, "mercy guidance"),
        makeQuranSearch("en", 2, "wisdom"),
        makeQuranSearch("id", 1, "rahmat petunjuk"),
      ])
    );
    const result = await t.query((ctx) =>
      runConvexProgram(searchQuran(ctx, "en", "mercy"))
    );
    const decoded = await Effect.runPromise(
      decodeSnapshotRowJson(result.rowJson[0] ?? "")
    );

    expect(result).toMatchObject({ managed: true, snapshotId });
    expect(result.rowJson).toHaveLength(1);
    expect(decoded).toMatchObject({
      record: {
        payload: { kind: "quran-search", locale: "en", surahNumber: 1 },
      },
    });
  });

  it("rejects a search projection that drifted from its signed row", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSearch("en", 1, "mercy")])
    );
    await t.mutation(async (ctx) => {
      const hit = await ctx.db.query("quranSearch").unique();
      if (!hit) {
        throw new Error("Expected one technical Quran search projection.");
      }
      await ctx.db.patch("quranSearch", hit._id, {
        rowHash: `sha256:${"8".repeat(64)}`,
      });
    });

    await expect(
      t.query((ctx) => runConvexProgram(searchQuran(ctx, "en", "mercy")))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
