import { api, internal } from "@repo/backend/convex/_generated/api";
import type { learningProgramCoverageInputValidator } from "@repo/backend/convex/learningPrograms/schema";
import {
  countTestPlanItems,
  drainSampleReconcile,
  drainStalePlanItems,
  getTestGraphIdentity,
  seedGeneratedPlanItems,
  seedLearningProgramCatalog,
  seedTestContentRoute,
  selectTestProgram,
  syncTestCoverage,
  TEST_NOW,
  TEST_PLAN_ITEM_COUNT,
} from "@repo/backend/convex/learningPrograms/testing";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { Infer } from "convex/values";
import { describe, expect, it } from "vitest";

const subjectGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure"
);
const replacementGraph = getTestGraphIdentity(
  "material/lesson/chemistry/atomic-structure/electron-configuration"
);
const staleGraph = getTestGraphIdentity(
  "material/lesson/biology/deleted-topic"
);

describe("learningPrograms/reconcile", () => {
  it("removes active plan items before deleting stale coverage", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );
    await seedLearningProgramCatalog(t);
    await seedTestContentRoute(t, {
      graph: staleGraph,
      route: "material/lesson/biology/deleted-topic",
      title: "Deleted Topic",
    });
    await seedTestContentRoute(t, {
      graph: subjectGraph,
      route: "material/lesson/chemistry/atomic-structure",
      title: "Atomic Structure",
    });
    await syncTestCoverage(t, [
      toCoverage(staleGraph, TEST_NOW - 1),
      toCoverage(subjectGraph, TEST_NOW),
    ]);
    const { authed, profile } = await selectTestProgram(t, identity);

    expect(profile.planItems.map((item) => item.content_id)).toContain(
      staleGraph.assetId
    );
    await t.mutation(
      internal.learningPrograms.coverage.deleteStaleLearningProgramCoverage,
      { limit: 10, locale: "id", syncedAt: TEST_NOW }
    );
    const active = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "id" }
    );

    expect(active?.planItems.map((item) => item.content_id)).toEqual([
      subjectGraph.assetId,
    ]);
  });

  it("refreshes active plan items when the coverage sample changes", async () => {
    const t = createConvexTestWithBetterAuth();
    const { authed } = await seedSelectedCoverage(t);
    await seedTestContentRoute(t, {
      graph: replacementGraph,
      route:
        "material/lesson/chemistry/atomic-structure/electron-configuration",
      title: "Electron Configuration",
    });

    await syncTestCoverage(t, [
      toCoverage(replacementGraph, TEST_NOW + 1, subjectGraph.lensId),
    ]);
    const active = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "id" }
    );

    expect(active?.planItems).toEqual([
      expect.objectContaining({
        content_id: replacementGraph.assetId,
        title: "Electron Configuration",
      }),
    ]);
  });

  it("refreshes route copy when coverage keeps the same sample", async () => {
    const t = createConvexTestWithBetterAuth();
    const { authed, routeId } = await seedSelectedCoverage(t);
    await t.mutation(async (ctx) => {
      await ctx.db.patch(routeId, {
        route: "material/lesson/chemistry/atomic-structure/renamed",
        title: "Atomic Structure Updated",
      });
    });

    await syncTestCoverage(t, [toCoverage(subjectGraph, TEST_NOW + 1)]);
    const active = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "id" }
    );

    expect(active?.planItems).toEqual([
      expect.objectContaining({
        route: "material/lesson/chemistry/atomic-structure/renamed",
        title: "Atomic Structure Updated",
      }),
    ]);
  });

  it("reconciles popular generated plan items through bounded pages", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );
    await seedLearningProgramCatalog(t);
    await syncTestCoverage(t, [toCoverage(subjectGraph, TEST_NOW)]);
    await seedTestContentRoute(t, {
      graph: replacementGraph,
      route:
        "material/lesson/chemistry/atomic-structure/electron-configuration",
      title: "Electron Configuration",
    });
    const plan = await seedGeneratedPlanItems(t, {
      contentId: subjectGraph.assetId,
      identity,
      lensId: subjectGraph.lensId,
      lensScope: "curriculum",
      programKey: "merdeka",
    });

    await syncTestCoverage(t, [
      toCoverage(replacementGraph, TEST_NOW + 1, subjectGraph.lensId),
    ]);
    await drainSampleReconcile(t, {
      lensId: subjectGraph.lensId,
      locale: "id",
      nextCoverageStatus: "partial",
      nextSampleContentId: replacementGraph.assetId,
      previousSampleContentId: subjectGraph.assetId,
      programId: plan.programId,
    });

    await expect(
      countTestPlanItems(t, {
        contentId: replacementGraph.assetId,
        lensId: subjectGraph.lensId,
        programId: plan.programId,
      })
    ).resolves.toBe(TEST_PLAN_ITEM_COUNT);
  });

  it("deletes popular generated plan items through bounded pages", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );
    await seedLearningProgramCatalog(t);
    await syncTestCoverage(t, [toCoverage(staleGraph, TEST_NOW - 1)]);
    const plan = await seedGeneratedPlanItems(t, {
      contentId: staleGraph.assetId,
      identity,
      lensId: staleGraph.lensId,
      lensScope: "curriculum",
      programKey: "merdeka",
    });

    await t.mutation(
      internal.learningPrograms.coverage.deleteStaleLearningProgramCoverage,
      { limit: 10, locale: "id", syncedAt: TEST_NOW }
    );
    await drainStalePlanItems(t, {
      lensId: staleGraph.lensId,
      programId: plan.programId,
      sampleContentId: staleGraph.assetId,
    });

    await expect(
      countTestPlanItems(t, {
        contentId: staleGraph.assetId,
        lensId: staleGraph.lensId,
        programId: plan.programId,
      })
    ).resolves.toBe(0);
  });
});

/** Creates one source-owned curriculum coverage input for a graph fixture. */
function toCoverage(
  graph: ReturnType<typeof getTestGraphIdentity>,
  syncedAt: number,
  lensId = graph.lensId
): Infer<typeof learningProgramCoverageInputValidator> {
  return {
    contentCount: 1,
    coverageStatus: "partial",
    lensId,
    lensScope: "curriculum",
    locale: "id",
    programKey: "merdeka",
    sampleContentId: graph.assetId,
    syncedAt,
  };
}

/** Seeds one selected program whose plan item follows the subject coverage. */
async function seedSelectedCoverage(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  const identity = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: TEST_NOW })
  );
  await seedLearningProgramCatalog(t);
  const routeId = await seedTestContentRoute(t, {
    graph: subjectGraph,
    route: "material/lesson/chemistry/atomic-structure",
    title: "Atomic Structure",
  });
  await syncTestCoverage(t, [toCoverage(subjectGraph, TEST_NOW)]);
  const selected = await selectTestProgram(t, identity);
  return { ...selected, routeId };
}
