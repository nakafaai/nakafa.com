import { api, internal } from "@repo/backend/convex/_generated/api";
import {
  getTestGraphIdentity,
  seedLearningProgramCatalog,
  syncTestCoverage,
  TEST_NOW,
} from "@repo/backend/convex/learningPrograms/testing";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { assert, describe, expect, it } from "vitest";

const subjectGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure"
);
const englishSubjectGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure",
  "en"
);

describe("learningPrograms/coverage", () => {
  it("lists canonical programs only for locales with stable-key coverage", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedLearningProgramCatalog(t);

    await expect(
      t.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "en",
      })
    ).resolves.toEqual([]);

    await syncTestCoverage(t, [
      {
        contentCount: 1,
        coverageStatus: "partial",
        lensId: subjectGraph.lensId,
        lensScope: "curriculum",
        locale: "id",
        programKey: "merdeka",
        sampleContentId: subjectGraph.assetId,
        syncedAt: TEST_NOW,
      },
      {
        contentCount: 1,
        coverageStatus: "partial",
        lensId: englishSubjectGraph.lensId,
        lensScope: "curriculum",
        locale: "en",
        programKey: "merdeka",
        sampleContentId: englishSubjectGraph.assetId,
        syncedAt: TEST_NOW,
      },
    ]);
    const coverage = await t.query((ctx) =>
      ctx.db
        .query("learningProgramCoverage")
        .withIndex("by_programKey_and_locale_and_lensId", (query) =>
          query.eq("programKey", "merdeka")
        )
        .take(10)
    );

    await expect(
      t.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "id",
      })
    ).resolves.toMatchObject([{ key: "merdeka", title: "Kurikulum Merdeka" }]);
    await expect(
      t.query(api.learningPrograms.queries.listSelectablePrograms, {
        locale: "en",
      })
    ).resolves.toMatchObject([{ key: "merdeka" }]);
    expect(coverage).toHaveLength(2);
    expect(coverage.every((row) => row.programKey === "merdeka")).toBe(true);
  });

  it("deletes stale coverage rows in bounded locale batches", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedLearningProgramCatalog(t);
    await syncTestCoverage(t, [
      {
        contentCount: 1,
        coverageStatus: "partial",
        lensId: "lens:subject:high-school:10:chemistry:old",
        lensScope: "curriculum",
        locale: "id",
        programKey: "merdeka",
        sampleContentId: subjectGraph.assetId,
        syncedAt: TEST_NOW - 1,
      },
      {
        contentCount: 1,
        coverageStatus: "partial",
        lensId: subjectGraph.lensId,
        lensScope: "curriculum",
        locale: "id",
        programKey: "merdeka",
        sampleContentId: subjectGraph.assetId,
        syncedAt: TEST_NOW,
      },
    ]);

    const result = await t.mutation(
      internal.learningPrograms.coverage.deleteStaleLearningProgramCoverage,
      { limit: 10, locale: "id", syncedAt: TEST_NOW }
    );
    const remaining = await t.query(async (ctx) => {
      const program = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", "merdeka"))
        .unique();
      assert(program, "Expected synced Kurikulum Merdeka program.");
      return await ctx.db
        .query("learningProgramCoverage")
        .withIndex("by_programId_and_locale_and_coverageStatus", (q) =>
          q
            .eq("programId", program._id)
            .eq("locale", "id")
            .eq("coverageStatus", "partial")
        )
        .take(10);
    });

    expect(result).toEqual({ deleted: 1 });
    expect(remaining.map((row) => row.lensId)).toEqual([subjectGraph.lensId]);
  });
});
