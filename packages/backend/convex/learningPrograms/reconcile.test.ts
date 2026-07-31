import { internal } from "@repo/backend/convex/_generated/api";
import { getLearningProgramCatalogInputs } from "@repo/backend/convex/learningPrograms/catalog";
import {
  type CoverageReconcileInput,
  reconcileCoverageSamplePlanItemBatch,
} from "@repo/backend/convex/learningPrograms/reconcile";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { assert, describe, expect, it } from "vitest";

describe("learningPrograms/reconcile", () => {
  it("rejects a continuation after the active content release changes", async () => {
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

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          reconcileCoverageSamplePlanItemBatch(ctx, {
            ...input,
            expectedActiveReleaseId: null,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
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
});
