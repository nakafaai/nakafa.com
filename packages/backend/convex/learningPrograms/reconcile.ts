import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { getContentRouteByContentId } from "@repo/backend/convex/learningPrograms/impl";
import { learningProgramCoverageInputValidator } from "@repo/backend/convex/learningPrograms/schema";
import { v } from "convex/values";

const ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE = 100;
const planItemReconcileResultValidator = v.object({
  reconciled: v.number(),
  scheduled: v.boolean(),
});

/** Continues a generated plan-item reconcile after a coverage sample changes. */
export const continueCoverageSamplePlanItemReconcile = internalMutation({
  args: {
    lensId: v.string(),
    locale: learningProgramCoverageInputValidator.fields.locale,
    nextCoverageStatus:
      learningProgramCoverageInputValidator.fields.coverageStatus,
    nextSampleContentId:
      learningProgramCoverageInputValidator.fields.sampleContentId,
    previousSampleContentId:
      learningProgramCoverageInputValidator.fields.sampleContentId,
    programId: v.id("learningPrograms"),
    updatedBefore: v.number(),
  },
  returns: planItemReconcileResultValidator,
  handler: async (ctx, args) =>
    await reconcileCoverageSamplePlanItemBatch(ctx, args),
});

/** Continues generated plan-item deletion after a stale coverage row disappears. */
export const continueStaleCoveragePlanItemDelete = internalMutation({
  args: {
    lensId: v.string(),
    sampleContentId:
      learningProgramCoverageInputValidator.fields.sampleContentId,
    programId: v.id("learningPrograms"),
  },
  returns: planItemReconcileResultValidator,
  handler: async (ctx, args) =>
    await deleteStaleCoveragePlanItemBatch(ctx, args),
});

/** Refreshes generated plan items after an existing coverage projection changes. */
export async function reconcileActivePlanItemsForCoverageRefresh(
  ctx: MutationCtx,
  {
    coverage,
    nextCoverageStatus,
    nextSampleContentId,
    updatedBefore,
  }: {
    coverage: Doc<"learningProgramCoverage">;
    nextCoverageStatus: Doc<"learningProgramCoverage">["coverageStatus"];
    nextSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
    updatedBefore: number;
  }
) {
  await reconcileCoverageSamplePlanItemBatch(ctx, {
    lensId: coverage.lensId,
    locale: coverage.locale,
    nextCoverageStatus,
    nextSampleContentId,
    previousSampleContentId: coverage.sampleContentId,
    programId: coverage.programId,
    updatedBefore,
  });
}

/** Removes generated active-plan items before their source coverage disappears. */
export async function deleteActivePlanItemsForStaleCoverage(
  ctx: MutationCtx,
  coverage: Doc<"learningProgramCoverage">
) {
  await deleteStaleCoveragePlanItemBatch(ctx, {
    lensId: coverage.lensId,
    programId: coverage.programId,
    sampleContentId: coverage.sampleContentId,
  });
}

/** Reconciles one bounded page of plan items for a changed coverage sample. */
async function reconcileCoverageSamplePlanItemBatch(
  ctx: MutationCtx,
  {
    lensId,
    locale,
    nextCoverageStatus,
    nextSampleContentId,
    previousSampleContentId,
    programId,
    updatedBefore,
  }: {
    lensId: string;
    locale: Doc<"learningProgramCoverage">["locale"];
    nextCoverageStatus: Doc<"learningProgramCoverage">["coverageStatus"];
    nextSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
    previousSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
    programId: Id<"learningPrograms">;
    updatedBefore: number;
  }
) {
  const keepsSameContentId = previousSampleContentId === nextSampleContentId;
  const planItems = keepsSameContentId
    ? await ctx.db
        .query("learningPlanItems")
        .withIndex(
          "by_programId_and_lensId_and_content_id_and_updatedAt",
          (q) =>
            q
              .eq("programId", programId)
              .eq("lensId", lensId)
              .eq("content_id", previousSampleContentId)
              .lt("updatedAt", updatedBefore)
        )
        .take(ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE)
    : await ctx.db
        .query("learningPlanItems")
        .withIndex("by_programId_and_lensId_and_content_id", (q) =>
          q
            .eq("programId", programId)
            .eq("lensId", lensId)
            .eq("content_id", previousSampleContentId)
        )
        .take(ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE);
  const route = await getContentRouteByContentId(ctx, {
    contentId: nextSampleContentId,
    locale,
  });
  let reconciled = 0;

  for (const item of planItems) {
    const plan = await ctx.db.get(item.planId);

    if (!plan) {
      await ctx.db.delete(item._id);
      continue;
    }

    if (!route) {
      await ctx.db.delete(item._id);
      reconciled++;
      continue;
    }

    await ctx.db.patch(item._id, {
      content_id: nextSampleContentId,
      coverageStatus: nextCoverageStatus,
      route: route.route,
      title: route.title,
      updatedAt: updatedBefore,
    });
    reconciled++;
  }

  const scheduled = planItems.length === ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE;

  if (scheduled) {
    await ctx.scheduler.runAfter(
      0,
      internal.learningPrograms.reconcile
        .continueCoverageSamplePlanItemReconcile,
      {
        lensId,
        locale,
        nextCoverageStatus,
        nextSampleContentId,
        previousSampleContentId,
        programId,
        updatedBefore,
      }
    );
  }

  return { reconciled, scheduled };
}

/** Deletes one bounded page of plan items for removed coverage. */
async function deleteStaleCoveragePlanItemBatch(
  ctx: MutationCtx,
  {
    lensId,
    programId,
    sampleContentId,
  }: {
    lensId: string;
    programId: Id<"learningPrograms">;
    sampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
  }
) {
  const planItems = await ctx.db
    .query("learningPlanItems")
    .withIndex("by_programId_and_lensId_and_content_id", (q) =>
      q
        .eq("programId", programId)
        .eq("lensId", lensId)
        .eq("content_id", sampleContentId)
    )
    .take(ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE);

  for (const item of planItems) {
    await ctx.db.delete(item._id);
  }

  const scheduled = planItems.length === ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE;

  if (scheduled) {
    await ctx.scheduler.runAfter(
      0,
      internal.learningPrograms.reconcile.continueStaleCoveragePlanItemDelete,
      {
        lensId,
        programId,
        sampleContentId,
      }
    );
  }

  return { reconciled: planItems.length, scheduled };
}
