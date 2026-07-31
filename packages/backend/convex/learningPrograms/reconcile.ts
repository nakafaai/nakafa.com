import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadLearningPlanTarget } from "@repo/backend/convex/learningPrograms/planTarget";
import { Effect } from "effect";

const ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE = 100;

/** Input shared by the initial coverage reconcile and every continuation. */
export interface CoverageReconcileInput {
  readonly expectedActiveReleaseId?: string | null;
  readonly lensId: string;
  readonly locale: Doc<"learningProgramCoverage">["locale"];
  readonly nextCoverageStatus: Doc<"learningProgramCoverage">["coverageStatus"];
  readonly nextSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
  readonly previousSampleContentId: Doc<"learningProgramCoverage">["sampleContentId"];
  readonly programId: Id<"learningPrograms">;
  readonly updatedBefore: number;
}

/** Pins a multi-batch reconcile to one globally active content release. */
const readActiveReleasePin = Effect.fn(
  "learningPrograms.readCoverageReleasePin"
)(function* (
  ctx: MutationCtx,
  expectedActiveReleaseId: CoverageReconcileInput["expectedActiveReleaseId"]
) {
  const active = yield* loadActiveIdentity(ctx);
  const activeReleaseId = active?.releaseId ?? null;
  if (
    expectedActiveReleaseId !== undefined &&
    activeReleaseId !== expectedActiveReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Learning-plan reconciliation changed active content release."
    );
  }
  return activeReleaseId;
});

/** Reconciles one bounded page of generated plan items for a changed sample. */
export const reconcileCoverageSamplePlanItemBatch = Effect.fn(
  "learningPrograms.reconcileCoveragePlanItems"
)(function* (ctx: MutationCtx, input: CoverageReconcileInput) {
  const {
    expectedActiveReleaseId,
    lensId,
    locale,
    nextCoverageStatus,
    nextSampleContentId,
    previousSampleContentId,
    programId,
    updatedBefore,
  } = input;
  const activeReleaseId = yield* readActiveReleasePin(
    ctx,
    expectedActiveReleaseId
  );
  const keepsSameContentId = previousSampleContentId === nextSampleContentId;
  const planItems = yield* Effect.promise(() =>
    keepsSameContentId
      ? ctx.db
          .query("learningPlanItems")
          .withIndex(
            "by_programId_and_lensId_and_content_id_and_updatedAt",
            (query) =>
              query
                .eq("programId", programId)
                .eq("lensId", lensId)
                .eq("content_id", previousSampleContentId)
                .lt("updatedAt", updatedBefore)
          )
          .take(ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE)
      : ctx.db
          .query("learningPlanItems")
          .withIndex("by_programId_and_lensId_and_content_id", (query) =>
            query
              .eq("programId", programId)
              .eq("lensId", lensId)
              .eq("content_id", previousSampleContentId)
          )
          .take(ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE)
  );

  const route = yield* loadLearningPlanTarget(ctx, nextSampleContentId, locale);
  let reconciled = 0;

  for (const item of planItems) {
    const plan = yield* Effect.promise(() => ctx.db.get(item.planId));

    if (!plan) {
      yield* Effect.promise(() => ctx.db.delete(item._id));
      continue;
    }

    if (!route) {
      yield* Effect.promise(() => ctx.db.delete(item._id));
      reconciled++;
      continue;
    }

    yield* Effect.promise(() =>
      ctx.db.patch(item._id, {
        content_id: nextSampleContentId,
        coverageStatus: nextCoverageStatus,
        route: route.route,
        title: route.title,
        updatedAt: updatedBefore,
      })
    );
    reconciled++;
  }

  const scheduled = planItems.length === ACTIVE_PLAN_ITEM_RECONCILE_BATCH_SIZE;
  const continuation = scheduled
    ? {
        expectedActiveReleaseId: activeReleaseId,
        lensId,
        locale,
        nextCoverageStatus,
        nextSampleContentId,
        previousSampleContentId,
        programId,
        updatedBefore,
      }
    : null;

  return { continuation, reconciled, scheduled };
});
