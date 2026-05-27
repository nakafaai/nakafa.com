import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { getAttemptEndReasonFromStatus } from "@repo/backend/confect/modules/learning/attempts.schemas";

/** Keeps a number within inclusive min/max bounds. */
function clampNumber(args: {
  readonly max: number;
  readonly min: number;
  readonly value: number;
}) {
  return Math.min(args.max, Math.max(args.min, args.value));
}

/** Computes a score percentage from correct and total counts. */
export function calculateScorePercentage(args: {
  readonly correctAnswers: number;
  readonly totalExercises: number;
}) {
  if (args.totalExercises <= 0) {
    return 0;
  }

  return (args.correctAnswers / args.totalExercises) * 100;
}

/** Applies answer aggregate deltas to an exercise attempt. */
export function applyAttemptAggregatesDelta(args: {
  readonly attempt: Doc<"exerciseAttempts">;
  readonly deltaAnsweredCount: number;
  readonly deltaCorrectAnswers: number;
  readonly deltaTotalTime: number;
}) {
  const answeredCount = clampNumber({
    max: args.attempt.totalExercises,
    min: 0,
    value: args.attempt.answeredCount + args.deltaAnsweredCount,
  });
  const correctAnswers = clampNumber({
    max: args.attempt.totalExercises,
    min: 0,
    value: args.attempt.correctAnswers + args.deltaCorrectAnswers,
  });
  const totalTime = Math.max(0, args.attempt.totalTime + args.deltaTotalTime);

  return {
    answeredCount,
    correctAnswers,
    scorePercentage: calculateScorePercentage({
      correctAnswers,
      totalExercises: args.attempt.totalExercises,
    }),
    totalTime,
  };
}

/** Computes a rounded non-negative attempt duration in seconds. */
export function computeAttemptDurationSeconds(args: {
  readonly completedAtMs: number;
  readonly startedAtMs: number;
}) {
  const wallClockSeconds = (args.completedAtMs - args.startedAtMs) / 1e3;
  return Math.max(0, Math.round(wallClockSeconds));
}

/** Builds the persisted patch for a finalized exercise attempt. */
export function buildFinalizedExerciseAttemptPatch(args: {
  readonly completedAtMs: number;
  readonly now: number;
  readonly status: "completed" | "expired";
  readonly totalTime: number;
}) {
  return {
    completedAt: args.completedAtMs,
    endReason: getAttemptEndReasonFromStatus(args.status),
    lastActivityAt: args.now,
    status: args.status,
    totalTime: args.totalTime,
    updatedAt: args.now,
  };
}
