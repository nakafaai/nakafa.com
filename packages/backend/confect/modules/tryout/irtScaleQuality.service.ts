import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import {
  getCalibrationWindowStartAt,
  IRT_MIN_ATTEMPTS_FOR_OFFICIAL_SCALE,
  IRT_MIN_RESPONSES_FOR_CALIBRATED,
} from "@repo/backend/confect/modules/tryout/irt.policy";
import type { IrtScaleQualityStatus } from "@repo/backend/confect/modules/tryout/irt.tables";
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
  readonly status: IrtScaleQualityStatus;
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
)(function* (args: { readonly now: number; readonly tryoutId: Id<"tryouts"> }) {
  const reader = yield* DatabaseReader;
  const tryout = yield* reader
    .table("tryouts")
    .get(args.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryout) {
    return null;
  }

  const tryoutPartSets = yield* reader
    .table("tryoutPartSets")
    .index("by_tryoutId_and_partIndex", (query) =>
      query.eq("tryoutId", args.tryoutId)
    )
    .take(tryout.partCount + 1);

  if (tryoutPartSets.length !== tryout.partCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_TRYOUT_PART_COUNT_MISMATCH",
        message: "Tryout part set count does not match the tryout part count.",
      })
    );
  }

  const sets = yield* Effect.forEach(
    tryoutPartSets,
    (partSet) =>
      reader
        .table("exerciseSets")
        .get(partSet.setId)
        .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null))),
    { concurrency: "unbounded" }
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

    const [cacheStats, itemParams, questions] = yield* Effect.all(
      [
        reader
          .table("irtCalibrationCacheStats")
          .get("by_setId", set._id)
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null))
          ),
        reader
          .table("exerciseItemParameters")
          .index("by_setId", (query) => query.eq("setId", set._id))
          .take(set.questionCount + 1),
        reader
          .table("exerciseQuestions")
          .index("by_setId", (query) => query.eq("setId", set._id))
          .take(set.questionCount + 1),
      ],
      { concurrency: "unbounded" }
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
)(function* (summary: ScaleQualitySummary) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingCheck = yield* reader
    .table("irtScaleQualityChecks")
    .get("by_tryoutId", summary.tryoutId)
    .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
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
    yield* writer
      .table("irtScaleQualityChecks")
      .patch(existingCheck._id, values);
    return summary;
  }

  yield* writer.table("irtScaleQualityChecks").insert({
    ...values,
    tryoutId: summary.tryoutId,
  });

  return summary;
});

/** Refreshes scale quality and reports whether the tryout still exists. */
export const refreshTryoutScaleQualityCheck = Effect.fn(
  "irt.scales.refreshTryoutScaleQualityCheck"
)(function* (tryoutId: Id<"tryouts">) {
  const now = yield* Clock.currentTimeMillis;
  const summary = yield* evaluateTryoutScaleQuality({ now, tryoutId });

  if (!summary) {
    return false;
  }

  yield* upsertTryoutScaleQualityCheck(summary);
  return true;
});
