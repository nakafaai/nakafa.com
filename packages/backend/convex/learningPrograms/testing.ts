import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { getLearningProgramCatalogInputs } from "@repo/backend/convex/learningPrograms/catalog";
import type { learningProgramCoverageInputValidator } from "@repo/backend/convex/learningPrograms/schema";
import type {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import type { Infer } from "convex/values";
import { assert, expect } from "vitest";

export const TEST_NOW = 1_798_752_000_000;
export const TEST_PLAN_ITEM_COUNT = 501;

type LearningProgramTest = ReturnType<typeof createConvexTestWithBetterAuth>;
type CoverageInput = Infer<typeof learningProgramCoverageInputValidator>;
type TestIdentity = Awaited<ReturnType<typeof seedAuthenticatedUser>>;
type TestGraph = ReturnType<typeof getTestGraphIdentity>;

/** Returns graph identity for a route fixture and fails fast when it is invalid. */
export function getTestGraphIdentity(
  route: string,
  locale: "en" | "id" = "id"
) {
  const identity = createLearningGraphIdentityFromRoute({ locale, route });
  assert(identity, `Expected graph identity for ${route}.`);
  return identity;
}

/** Synchronizes the real source-owned program catalog for a backend test. */
export async function seedLearningProgramCatalog(
  t: LearningProgramTest,
  syncedAt = TEST_NOW
) {
  return await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
    programs: getLearningProgramCatalogInputs(),
    syncedAt,
  });
}

/** Synchronizes one or more coverage rows through the registered mutation. */
export async function syncTestCoverage(
  t: LearningProgramTest,
  coverageRows: CoverageInput[]
) {
  return await t.mutation(
    internal.learningPrograms.coverage.syncLearningProgramCoverage,
    { coverageRows }
  );
}

/** Synchronizes one graph fixture as program coverage for selection tests. */
export async function syncTestGraphCoverage(
  t: LearningProgramTest,
  {
    graph,
    lensScope,
    locale,
    programKey,
  }: {
    graph: TestGraph;
    lensScope: CoverageInput["lensScope"];
    locale: CoverageInput["locale"];
    programKey: string;
  }
) {
  return await syncTestCoverage(t, [
    {
      contentCount: 1,
      coverageStatus: "partial",
      lensId: graph.lensId,
      lensScope,
      locale,
      programKey,
      sampleContentId: graph.assetId,
      syncedAt: TEST_NOW,
    },
  ]);
}

/** Seeds one content route projection used by generated plan-item tests. */
export async function seedTestContentRoute(
  t: LearningProgramTest,
  {
    graph,
    route,
    title,
  }: {
    graph: TestGraph;
    route: string;
    title: string;
  }
) {
  return await t.mutation(
    async (ctx) =>
      await ctx.db.insert("contentRoutes", {
        ...graph,
        authors: [],
        contentHash: `${graph.assetId}-hash`,
        content_id: graph.assetId,
        kind: "curriculum-topic",
        locale: "id",
        markdown: true,
        route,
        section: "material",
        sourcePath: route,
        syncedAt: TEST_NOW,
        title,
      })
  );
}

/** Selects one program for a seeded user and returns its authenticated client. */
export async function selectTestProgram(
  t: LearningProgramTest,
  identity: TestIdentity,
  {
    locale = "id",
    programKey = "merdeka",
  }: {
    locale?: "en" | "id";
    programKey?: string;
  } = {}
) {
  const authed = t.withIdentity({
    sessionId: identity.sessionId,
    subject: identity.authUserId,
  });
  const profile = await authed.mutation(
    api.learningPrograms.mutations.selectLearningProgram,
    {
      interests: ["school-curriculum"],
      locale,
      primaryProgramKey: programKey,
    }
  );

  return { authed, profile };
}

/** Seeds many generated plan items to exercise bounded continuation behavior. */
export async function seedGeneratedPlanItems(
  t: LearningProgramTest,
  {
    contentId,
    count = TEST_PLAN_ITEM_COUNT,
    identity,
    lensId,
    lensScope,
    programKey,
  }: {
    contentId: string;
    count?: number;
    identity: TestIdentity;
    lensId: string;
    lensScope: Doc<"learningProgramCoverage">["lensScope"];
    programKey: string;
  }
) {
  return await t.mutation(async (ctx) => {
    const program = await ctx.db
      .query("learningPrograms")
      .withIndex("by_key", (q) => q.eq("key", programKey))
      .unique();
    assert(program, `Expected synced program ${programKey}.`);
    const profileId = await ctx.db.insert("learningProfiles", {
      interests: ["school-curriculum"],
      programId: program._id,
      programKey: program.key,
      updatedAt: TEST_NOW,
      userId: identity.userId,
    });
    const planId = await ctx.db.insert("learningPlans", {
      createdAt: TEST_NOW,
      profileId,
      programId: program._id,
      programKey: program.key,
      status: "active",
      updatedAt: TEST_NOW,
      userId: identity.userId,
      version: 1,
    });

    await ctx.db.patch(profileId, { activePlanId: planId });
    for (let index = 0; index < count; index++) {
      await ctx.db.insert("learningPlanItems", {
        content_id: contentId,
        coverageStatus: "partial",
        createdAt: TEST_NOW,
        lensId,
        lensScope,
        planId,
        position: index + 1,
        programId: program._id,
        programKey: program.key,
        reason: "program-alignment",
        route: `fixture/old-${index + 1}`,
        status: "ready",
        title: `Old Item ${index + 1}`,
        updatedAt: TEST_NOW,
        userId: identity.userId,
      });
    }

    return { planId, programId: program._id, profileId };
  });
}

/** Counts generated plan items for one program, lens, and content sample. */
export async function countTestPlanItems(
  t: LearningProgramTest,
  {
    contentId,
    lensId,
    programId,
  }: {
    contentId: string;
    lensId: string;
    programId: Id<"learningPrograms">;
  }
) {
  return await t.query(async (ctx) => {
    const rows = await ctx.db
      .query("learningPlanItems")
      .withIndex("by_programId_and_lensId_and_content_id", (q) =>
        q
          .eq("programId", programId)
          .eq("lensId", lensId)
          .eq("content_id", contentId)
      )
      .take(TEST_PLAN_ITEM_COUNT + 1);
    return rows.length;
  });
}

/** Drains sample-change continuation pages until no old plan item remains. */
export async function drainSampleReconcile(
  t: LearningProgramTest,
  args: {
    lensId: string;
    locale: Doc<"learningProgramCoverage">["locale"];
    nextCoverageStatus: Doc<"learningProgramCoverage">["coverageStatus"];
    nextSampleContentId: string;
    previousSampleContentId: string;
    programId: Id<"learningPrograms">;
  }
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const remaining = await countTestPlanItems(t, {
      contentId: args.previousSampleContentId,
      lensId: args.lensId,
      programId: args.programId,
    });
    if (remaining === 0) {
      return;
    }
    await t.mutation(
      internal.learningPrograms.reconcile
        .continueCoverageSamplePlanItemReconcile,
      { ...args, updatedBefore: TEST_NOW + 1 }
    );
  }
  expect.fail("Expected generated plan item sample reconcile to drain.");
}

/** Drains stale-coverage continuation pages until no plan item remains. */
export async function drainStalePlanItems(
  t: LearningProgramTest,
  args: {
    lensId: string;
    programId: Id<"learningPrograms">;
    sampleContentId: string;
  }
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const remaining = await countTestPlanItems(t, {
      contentId: args.sampleContentId,
      lensId: args.lensId,
      programId: args.programId,
    });
    if (remaining === 0) {
      return;
    }
    await t.mutation(
      internal.learningPrograms.reconcile.continueStaleCoveragePlanItemDelete,
      args
    );
  }
  expect.fail("Expected generated plan item stale delete to drain.");
}
