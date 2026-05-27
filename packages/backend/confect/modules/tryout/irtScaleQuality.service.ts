import type { Id } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import {
  getCalibrationWindowStartAt,
  IRT_MIN_ATTEMPTS_FOR_OFFICIAL_SCALE,
  IRT_MIN_RESPONSES_FOR_CALIBRATED,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import { getAll } from "convex-helpers/server/relationships";
import { Clock, Effect } from "effect";

interface ScaleQualitySummary {
  readonly blockingReason:
    | "insufficient-live-attempts"
    | "missing-calibrated-items"
    | "stale-calibration-window"
    | null;
  readonly calibratedQuestionCount: number;
  readonly checkedAt: number;
  readonly liveWindowStartAt: number;
  readonly minAttemptCount: number;
  readonly staleQuestionCount: number;
  readonly status: "blocked" | "passed";
  readonly totalQuestionCount: number;
  readonly tryoutId: Id<"tryouts">;
}

/** Resolves the blocking reason for official scale publication. */
function getBlockingReason(args: {
  readonly calibratedQuestionCount: number;
  readonly minAttemptCount: number;
  readonly staleQuestionCount: number;
  readonly totalQuestionCount: number;
}): ScaleQualitySummary["blockingReason"] {
  if (args.calibratedQuestionCount !== args.totalQuestionCount) {
    return "missing-calibrated-items";
  }

  if (args.staleQuestionCount > 0) {
    return "stale-calibration-window";
  }

  if (args.minAttemptCount < IRT_MIN_ATTEMPTS_FOR_OFFICIAL_SCALE) {
    return "insufficient-live-attempts";
  }

  return null;
}

/** Evaluates whether a tryout has enough fresh calibrated items for official scale publication. */
export const evaluateTryoutScaleQuality = Effect.fn(
  "irt.scales.evaluateTryoutScaleQuality"
)(function* (
  db: ConvexMutationCtx["db"],
  args: { readonly now: number; readonly tryoutId: Id<"tryouts"> }
) {
  const tryout = yield* Effect.promise(() => db.get(args.tryoutId));

  if (!tryout) {
    return null;
  }

  const tryoutPartSets = yield* Effect.promise(() =>
    db
      .query("tryoutPartSets")
      .withIndex("by_tryoutId_and_partIndex", (query) =>
        query.eq("tryoutId", args.tryoutId)
      )
      .take(tryout.partCount + 1)
  );

  if (tryoutPartSets.length !== tryout.partCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_TRYOUT_PART_COUNT_MISMATCH",
        message: "Tryout part set count does not match the tryout part count.",
      })
    );
  }

  const sets = yield* Effect.promise(() =>
    getAll(
      db,
      "exerciseSets",
      tryoutPartSets.map((partSet) => partSet.setId)
    )
  );
  const liveWindowStartAt = getCalibrationWindowStartAt(args.now);
  let calibratedQuestionCount = 0;
  let minAttemptCount = Number.POSITIVE_INFINITY;
  let staleQuestionCount = 0;
  let totalQuestionCount = 0;

  for (const [index] of tryoutPartSets.entries()) {
    const set = sets[index];

    if (!set) {
      minAttemptCount = 0;
      continue;
    }

    const [cacheStats, itemParams, questions] = yield* Effect.promise(() =>
      Promise.all([
        db
          .query("irtCalibrationCacheStats")
          .withIndex("by_setId", (query) => query.eq("setId", set._id))
          .unique(),
        db
          .query("exerciseItemParameters")
          .withIndex("by_setId", (query) => query.eq("setId", set._id))
          .take(set.questionCount + 1),
        db
          .query("exerciseQuestions")
          .withIndex("by_setId", (query) => query.eq("setId", set._id))
          .take(set.questionCount + 1),
      ])
    );

    if (itemParams.length > set.questionCount) {
      return yield* Effect.fail(
        new IrtError({
          code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
          message:
            "Exercise item parameter count exceeds the set question count.",
        })
      );
    }

    if (questions.length > set.questionCount) {
      return yield* Effect.fail(
        new IrtError({
          code: "IRT_QUESTION_COUNT_EXCEEDED",
          message: "Exercise question count exceeds the set question count.",
        })
      );
    }

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
    minAttemptCount,
    staleQuestionCount,
    totalQuestionCount,
  });
  const status = blockingReason ? ("blocked" as const) : ("passed" as const);

  return {
    blockingReason,
    calibratedQuestionCount,
    checkedAt: args.now,
    liveWindowStartAt,
    minAttemptCount,
    staleQuestionCount,
    status,
    totalQuestionCount,
    tryoutId: args.tryoutId,
  };
});

/** Upserts the persisted scale-quality summary for one tryout. */
export const upsertTryoutScaleQualityCheck = Effect.fn(
  "irt.scales.upsertTryoutScaleQualityCheck"
)(function* (db: ConvexMutationCtx["db"], summary: ScaleQualitySummary) {
  const existingCheck = yield* Effect.promise(() =>
    db
      .query("irtScaleQualityChecks")
      .withIndex("by_tryoutId", (query) =>
        query.eq("tryoutId", summary.tryoutId)
      )
      .unique()
  );
  const values = {
    blockingReason: summary.blockingReason,
    calibratedQuestionCount: summary.calibratedQuestionCount,
    checkedAt: summary.checkedAt,
    liveWindowStartAt: summary.liveWindowStartAt,
    minAttemptCount: summary.minAttemptCount,
    staleQuestionCount: summary.staleQuestionCount,
    status: summary.status,
    totalQuestionCount: summary.totalQuestionCount,
  };

  if (existingCheck) {
    yield* Effect.promise(() => db.patch(existingCheck._id, values));
    return summary;
  }

  yield* Effect.promise(() =>
    db.insert("irtScaleQualityChecks", {
      ...values,
      tryoutId: summary.tryoutId,
    })
  );

  return summary;
});

/** Refreshes scale quality and reports whether the tryout still exists. */
export const refreshTryoutScaleQualityCheck = Effect.fn(
  "irt.scales.refreshTryoutScaleQualityCheck"
)(function* (db: ConvexMutationCtx["db"], tryoutId: Id<"tryouts">) {
  const now = yield* Clock.currentTimeMillis;
  const summary = yield* evaluateTryoutScaleQuality(db, { now, tryoutId });

  if (!summary) {
    return false;
  }

  yield* upsertTryoutScaleQualityCheck(db, summary);
  return true;
});
