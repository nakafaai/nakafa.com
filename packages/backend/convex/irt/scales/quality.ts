import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  getCalibrationWindowStartAt,
  IRT_MIN_ATTEMPTS_FOR_OFFICIAL_SCALE,
  IRT_MIN_RESPONSES_FOR_CALIBRATED,
} from "@repo/backend/convex/irt/policy";
import { v } from "convex/values";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";

type IrtDbReader = QueryCtx["db"] | MutationCtx["db"];

const SCALE_QUALITY_REBUILD_BATCH_SIZE = 100;

export const scaleQualityRebuildResultValidator = v.object({
  isDone: v.boolean(),
  processedCount: v.number(),
});

function getBlockingReason({
  calibratedQuestionCount,
  staleQuestionCount,
  totalQuestionCount,
  minAttemptCount,
}: {
  calibratedQuestionCount: number;
  staleQuestionCount: number;
  totalQuestionCount: number;
  minAttemptCount: number;
}) {
  if (calibratedQuestionCount !== totalQuestionCount) {
    return "missing-calibrated-items";
  }

  if (staleQuestionCount > 0) {
    return "stale-calibration-window";
  }

  if (minAttemptCount < IRT_MIN_ATTEMPTS_FOR_OFFICIAL_SCALE) {
    return "insufficient-live-attempts";
  }

  return null;
}

/** Evaluates whether one tryout is ready for an official frozen scale. */
export async function evaluateTryoutScaleQuality(
  db: IrtDbReader,
  {
    now,
    tryoutId,
  }: {
    now: number;
    tryoutId: Id<"tryouts">;
  }
) {
  const [tryout, tryoutPartSets] = await Promise.all([
    db.get("tryouts", tryoutId),
    getManyFrom(
      db,
      "tryoutPartSets",
      "tryoutId_partIndex",
      tryoutId,
      "tryoutId"
    ),
  ]);

  if (!tryout) {
    return null;
  }

  const sets = await getAll(
    db,
    "exerciseSets",
    tryoutPartSets.map((partSet) => partSet.setId)
  );
  const liveWindowStartAt = getCalibrationWindowStartAt(now);
  let calibratedQuestionCount = 0;
  let staleQuestionCount = 0;
  let totalQuestionCount = 0;
  let minAttemptCount = Number.POSITIVE_INFINITY;

  for (const [index] of tryoutPartSets.entries()) {
    const set = sets[index];

    if (!set) {
      minAttemptCount = 0;
      continue;
    }

    const [cacheStats, itemParams, questions] = await Promise.all([
      db
        .query("irtCalibrationCacheStats")
        .withIndex("by_setId", (q) => q.eq("setId", set._id))
        .unique(),
      getManyFrom(db, "exerciseItemParameters", "by_setId", set._id, "setId"),
      getManyFrom(db, "exerciseQuestions", "setId", set._id, "setId"),
    ]);

    totalQuestionCount += questions.length;
    minAttemptCount = Math.min(minAttemptCount, cacheStats?.attemptCount ?? 0);

    const itemParamsByQuestionId = new Map(
      itemParams.map((params) => [params.questionId, params])
    );

    for (const question of questions) {
      const params = itemParamsByQuestionId.get(question._id);

      if (
        !params ||
        params.calibrationStatus !== "calibrated" ||
        params.calibrationRunId === undefined ||
        params.responseCount < IRT_MIN_RESPONSES_FOR_CALIBRATED
      ) {
        continue;
      }

      calibratedQuestionCount += 1;

      if (params.calibratedAt < liveWindowStartAt) {
        staleQuestionCount += 1;
      }
    }
  }

  if (!Number.isFinite(minAttemptCount)) {
    minAttemptCount = 0;
  }

  const blockingReason = getBlockingReason({
    calibratedQuestionCount,
    staleQuestionCount,
    totalQuestionCount,
    minAttemptCount,
  });

  return {
    tryoutId,
    status: blockingReason ? "blocked" : "passed",
    blockingReason,
    totalQuestionCount,
    calibratedQuestionCount,
    staleQuestionCount,
    minAttemptCount,
    liveWindowStartAt,
    checkedAt: now,
  } satisfies Pick<
    Doc<"irtScaleQualityChecks">,
    | "tryoutId"
    | "status"
    | "blockingReason"
    | "totalQuestionCount"
    | "calibratedQuestionCount"
    | "staleQuestionCount"
    | "minAttemptCount"
    | "liveWindowStartAt"
    | "checkedAt"
  >;
}

/** Upserts one tryout's current scale-quality summary. */
export async function upsertTryoutScaleQualityCheck(
  db: MutationCtx["db"],
  summary: NonNullable<Awaited<ReturnType<typeof evaluateTryoutScaleQuality>>>
) {
  const existingCheck = await db
    .query("irtScaleQualityChecks")
    .withIndex("by_tryoutId", (q) => q.eq("tryoutId", summary.tryoutId))
    .unique();

  if (existingCheck) {
    await db.patch("irtScaleQualityChecks", existingCheck._id, {
      status: summary.status,
      blockingReason: summary.blockingReason,
      totalQuestionCount: summary.totalQuestionCount,
      calibratedQuestionCount: summary.calibratedQuestionCount,
      staleQuestionCount: summary.staleQuestionCount,
      minAttemptCount: summary.minAttemptCount,
      liveWindowStartAt: summary.liveWindowStartAt,
      checkedAt: summary.checkedAt,
    });

    return summary;
  }

  await db.insert("irtScaleQualityChecks", summary);
  return summary;
}

/** Recomputes one tryout's scale-quality summary. */
export async function refreshScaleQualityCheckHandler(
  ctx: MutationCtx,
  args: {
    tryoutId: Id<"tryouts">;
  }
) {
  const summary = await evaluateTryoutScaleQuality(ctx.db, {
    now: Date.now(),
    tryoutId: args.tryoutId,
  });

  if (!summary) {
    return null;
  }

  await upsertTryoutScaleQualityCheck(ctx.db, summary);
  return null;
}

/** Rebuilds all tryout scale-quality summaries in bounded pages. */
export async function rebuildScaleQualityChecksPageHandler(
  ctx: MutationCtx,
  args: {
    cursor?: string;
  }
) {
  const page = await ctx.db.query("tryouts").paginate({
    cursor: args.cursor ?? null,
    numItems: SCALE_QUALITY_REBUILD_BATCH_SIZE,
  });

  for (const tryout of page.page) {
    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.refreshScaleQualityCheck,
      { tryoutId: tryout._id }
    );
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.rebuildScaleQualityChecksPage,
      { cursor: page.continueCursor }
    );
  }

  return {
    isDone: page.isDone,
    processedCount: page.page.length,
  };
}
