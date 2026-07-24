import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import {
  getLearningProgramCatalogInputs,
  type LearningProgramSyncInput,
} from "@repo/backend/convex/learningPrograms/catalog";
import {
  getTestGraphIdentity,
  seedGeneratedPlanItems,
  selectTestProgram,
  syncTestCoverage,
  TEST_NOW,
  TEST_PLAN_ITEM_COUNT,
} from "@repo/backend/convex/learningPrograms/testing";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const subjectGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure"
);

describe("learningPrograms/omitted", () => {
  it("deletes omitted catalog rows and generated user-state dependents", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );
    const catalog = getLearningProgramCatalogInputs();
    const retiredProgram = getRetiredProgram();

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: [...catalog, retiredProgram],
      syncedAt: TEST_NOW,
    });
    await syncTestCoverage(t, [
      {
        contentCount: 1,
        coverageStatus: "partial",
        lensId: subjectGraph.lensId,
        lensScope: "curriculum",
        locale: "id",
        programKey: retiredProgram.key,
        sampleContentId: subjectGraph.assetId,
        syncedAt: TEST_NOW,
      },
    ]);
    const programId = await findProgramId(t, retiredProgram.key);
    expect(programId).not.toBeNull();
    if (!programId) {
      return;
    }
    const { authed } = await selectTestProgram(t, identity, {
      programKey: retiredProgram.key,
    });

    const result = await t.mutation(
      internal.learningPrograms.sync.syncLearningPrograms,
      { programs: catalog, syncedAt: TEST_NOW + 1 }
    );
    const activeProfile = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      {}
    );

    expect(result).toEqual({ created: 0, skipped: 0, updated: 7 });
    expect(activeProfile).toBeNull();
    await expect(countRowsForProgram(t, programId)).resolves.toEqual({
      coverage: 0,
      items: 0,
      plans: 0,
      profiles: 0,
      program: 0,
      sources: 0,
    });
  });

  it("continues cleanup through bounded generated plan-item pages", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );
    const catalog = getLearningProgramCatalogInputs();
    const retiredProgram = getRetiredProgram();

    await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: [...catalog, retiredProgram],
      syncedAt: TEST_NOW,
    });
    const { programId } = await seedGeneratedPlanItems(t, {
      contentId: subjectGraph.assetId,
      identity,
      lensId: subjectGraph.lensId,
      lensScope: "curriculum",
      programKey: retiredProgram.key,
    });

    const result = await t.mutation(
      internal.learningPrograms.sync.syncLearningPrograms,
      { programs: catalog, syncedAt: TEST_NOW + 1 }
    );
    expect(result).toEqual({ created: 0, skipped: 0, updated: catalog.length });

    await drainOmittedProgramDelete(t, {
      omittedAt: TEST_NOW + 1,
      programId,
    });
    await expect(countRowsForProgram(t, programId)).resolves.toEqual({
      coverage: 0,
      items: 0,
      plans: 0,
      profiles: 0,
      program: 0,
      sources: 0,
    });
  });
});

/** Builds the source-owned retired program used by omission tests. */
function getRetiredProgram() {
  const [program] = getLearningProgramCatalogInputs();
  return {
    ...program,
    displayOrder: 50,
    key: "retired-school-curriculum",
    translations: {
      en: {
        publicSlug: "retired-school-curriculum",
        title: "Retired School Curriculum",
      },
      id: {
        publicSlug: "retired-school-curriculum",
        title: "Kurikulum Sekolah Lama",
      },
    },
  } satisfies LearningProgramSyncInput;
}

/** Finds one program id from its stable source-owned key. */
async function findProgramId(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  programKey: string
) {
  return await t.query(async (ctx) => {
    const program = await ctx.db
      .query("learningPrograms")
      .withIndex("by_key", (q) => q.eq("key", programKey))
      .unique();
    return program?._id ?? null;
  });
}

/** Continues omitted-program deletion until its catalog row disappears. */
async function drainOmittedProgramDelete(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  args: { omittedAt: number; programId: Id<"learningPrograms"> }
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const remaining = await countRowsForProgram(t, args.programId);
    if (remaining.program === 0) {
      return;
    }
    await t.mutation(
      internal.learningPrograms.sync.continueOmittedProgramDelete,
      args
    );
  }
  expect.fail("Expected omitted program delete to drain.");
}

/** Counts rows removed by omitted-program dependency cleanup. */
async function countRowsForProgram(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  programId: Id<"learningPrograms">
) {
  return await t.query(async (ctx) => {
    const program = await ctx.db.get(programId);
    const tables = await Promise.all([
      ctx.db
        .query("learningProfiles")
        .withIndex("by_programId", (q) => q.eq("programId", programId))
        .take(TEST_PLAN_ITEM_COUNT + 1),
      ctx.db
        .query("learningPlans")
        .withIndex("by_programId", (q) => q.eq("programId", programId))
        .take(TEST_PLAN_ITEM_COUNT + 1),
      ctx.db
        .query("learningProgramSources")
        .withIndex("by_programId", (q) => q.eq("programId", programId))
        .take(TEST_PLAN_ITEM_COUNT + 1),
      ctx.db
        .query("learningProgramCoverage")
        .withIndex("by_programId_and_locale_and_lensId", (q) =>
          q.eq("programId", programId)
        )
        .take(TEST_PLAN_ITEM_COUNT + 1),
      ctx.db
        .query("learningPlanItems")
        .withIndex("by_programId_and_lensId_and_content_id", (q) =>
          q.eq("programId", programId)
        )
        .take(TEST_PLAN_ITEM_COUNT + 1),
    ]);
    const [profiles, plans, sources, coverage, items] = tables;

    return {
      coverage: coverage.length,
      items: items.length,
      plans: plans.length,
      profiles: profiles.length,
      program: program ? 1 : 0,
      sources: sources.length,
    };
  });
}
