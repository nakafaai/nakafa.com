import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { internal } from "@repo/backend/convex/_generated/api";
import { getLearningProgramCatalogInputs } from "@repo/backend/convex/learningPrograms/catalog";
import {
  type CoverageReconcileInput,
  reconcileCoverageSamplePlanItemBatch,
} from "@repo/backend/convex/learningPrograms/reconcile";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { testTextHash } from "@repo/backend/test/content-release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  getTestGraphIdentity,
  seedGeneratedPlanItems,
  seedLearningProgramCatalog,
  seedTestContentRoute,
  TEST_NOW,
} from "@repo/backend/test/learning-programs";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { assert, describe, expect, it } from "vitest";

const NEXT_IDENTITY = {
  manifestHash: testTextHash("manifest-reconcile-next"),
  releaseId: ReleaseIdSchema.make("release-reconcile-next"),
  sequence: 2,
} satisfies TestIdentity;

describe("learningPrograms/reconcile", () => {
  it("restarts a continuation after the active content release changes", async () => {
    const target = convexTest(schema, convexModules);
    const sample = makeMaterialProjection("en", 1);
    await target.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
      programs: getLearningProgramCatalogInputs(),
      syncedAt: 1,
    });
    await activateMaterialCatalog(target);
    const program = await target.run((ctx) =>
      ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (index) => index.eq("key", "merdeka"))
        .unique()
    );
    assert(program, "Expected the Merdeka program.");
    const input = {
      lensId: sample.graph.lensId,
      locale: sample.locale,
      nextCoverageStatus: "partial",
      nextSampleContentId: sample.graph.assetId,
      previousSampleContentId: sample.graph.assetId,
      programId: program._id,
      updatedBefore: 2,
    } satisfies Omit<CoverageReconcileInput, "expectedActiveReleaseId">;

    const restarted = await target.mutation((ctx) =>
      runConvexProgram(
        reconcileCoverageSamplePlanItemBatch(ctx, {
          ...input,
          expectedActiveReleaseId: null,
        })
      )
    );

    expect(restarted).toMatchObject({
      continuation: {
        expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
        nextSampleContentId: input.nextSampleContentId,
        previousSampleContentId: input.previousSampleContentId,
        refreshAfterTransition: false,
      },
      reconciled: 0,
      scheduled: true,
    });
    expect(restarted.continuation?.updatedBefore).toBeGreaterThan(
      input.updatedBefore
    );
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          reconcileCoverageSamplePlanItemBatch(ctx, {
            ...input,
            expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
          })
        )
      )
    ).resolves.toEqual({
      continuation: null,
      reconciled: 0,
      scheduled: false,
    });
  });

  it("restores every unresolved row when the release changes between batches", async () => {
    const target = createConvexTestWithBetterAuth();
    const identity = await target.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );
    const previous = getTestGraphIdentity(
      "material/lesson/chemistry/atomic-structure"
    );
    const next = getTestGraphIdentity(
      "material/lesson/chemistry/atomic-structure/electron-configuration"
    );
    await seedLearningProgramCatalog(target);
    const exact = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [exact]);
    await selectExactMaterial(target, exact);
    const plan = await seedGeneratedPlanItems(target, {
      contentId: previous.assetId,
      count: 101,
      identity,
      lensId: previous.lensId,
      lensScope: "curriculum",
      programKey: "merdeka",
    });
    const input = {
      expectedActiveReleaseId: MATERIAL_IDENTITY.releaseId,
      lensId: previous.lensId,
      locale: "id",
      nextCoverageStatus: "partial",
      nextSampleContentId: next.assetId,
      previousSampleContentId: previous.assetId,
      programId: plan.programId,
      updatedBefore: TEST_NOW + 1,
    } satisfies CoverageReconcileInput;

    const first = await target.mutation((ctx) =>
      runConvexProgram(reconcileCoverageSamplePlanItemBatch(ctx, input))
    );
    const firstContinuation = first.continuation;
    assert(firstContinuation, "Expected a bounded first continuation.");

    await seedTestContentRoute(target, {
      graph: next,
      route:
        "material/lesson/chemistry/atomic-structure/electron-configuration",
      title: "Electron Configuration Updated",
    });
    await target.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...NEXT_IDENTITY,
        base: MATERIAL_IDENTITY,
        ownership: { base: ["material"], result: [] },
        role: "candidate",
        status: "completed",
      });
      const state = await ctx.db.query("contentState").unique();
      assert(state, "Expected active content state.");
      await ctx.db.patch("contentState", state._id, {
        activeManifestHash: NEXT_IDENTITY.manifestHash,
        activeReleaseId: NEXT_IDENTITY.releaseId,
        activeSequence: NEXT_IDENTITY.sequence,
        materialManifestHash: NEXT_IDENTITY.manifestHash,
        materialOwnerManifestHash: NEXT_IDENTITY.manifestHash,
        materialOwnerReleaseId: NEXT_IDENTITY.releaseId,
        materialOwnerSequence: NEXT_IDENTITY.sequence,
        materialReleaseId: NEXT_IDENTITY.releaseId,
        materialSequence: NEXT_IDENTITY.sequence,
      });
      const owners = await ctx.db.query("materialOwners").take(2);
      for (const owner of owners) {
        await ctx.db.patch(owner._id, {
          releaseId: NEXT_IDENTITY.releaseId,
          sequence: NEXT_IDENTITY.sequence,
        });
      }
    });

    let continuation = (
      await target.mutation((ctx) =>
        runConvexProgram(
          reconcileCoverageSamplePlanItemBatch(ctx, firstContinuation)
        )
      )
    ).continuation;
    for (let attempt = 0; continuation && attempt < 5; attempt++) {
      const current = continuation;
      continuation = (
        await target.mutation((ctx) =>
          runConvexProgram(reconcileCoverageSamplePlanItemBatch(ctx, current))
        )
      ).continuation;
    }

    const rows = await target.query((ctx) =>
      ctx.db
        .query("learningPlanItems")
        .withIndex("by_programId_and_lensId_and_content_id", (index) =>
          index
            .eq("programId", plan.programId)
            .eq("lensId", previous.lensId)
            .eq("content_id", next.assetId)
        )
        .take(102)
    );

    expect(continuation).toBeNull();
    expect(rows).toHaveLength(101);
    expect(
      rows.every(
        (row) =>
          row.route ===
            "material/lesson/chemistry/atomic-structure/electron-configuration" &&
          row.title === "Electron Configuration Updated"
      )
    ).toBe(true);
  });
});
