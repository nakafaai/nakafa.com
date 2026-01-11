import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import { clampNumber } from "../utils/helper";
import type { ExerciseAttemptMode } from "./schema";

type ExerciseAttemptAggregates = Pick<
  Doc<"exerciseAttempts">,
  "answeredCount" | "correctAnswers" | "totalExercises" | "totalTime"
>;

type ExerciseAttemptAggregatesPatch = Pick<
  WithoutSystemFields<Doc<"exerciseAttempts">>,
  "answeredCount" | "correctAnswers" | "totalTime" | "scorePercentage"
>;

type ExerciseAttemptStatsCore = Pick<
  Doc<"exerciseAttemptStats">,
  | "totalAttempts"
  | "bestScore"
  | "averageScore"
  | "bestTimeSeconds"
  | "averageTimeSeconds"
>;

type ExerciseAttemptStatsPatch = Pick<
  WithoutSystemFields<Doc<"exerciseAttemptStats">>,
  | "totalAttempts"
  | "bestScore"
  | "averageScore"
  | "bestTimeSeconds"
  | "averageTimeSeconds"
  | "lastAttemptAt"
  | "lastAttemptMode"
  | "updatedAt"
>;

export function calculateScorePercentage({
  correctAnswers,
  totalExercises,
}: {
  correctAnswers: number;
  totalExercises: number;
}): number {
  if (totalExercises <= 0) {
    return 0;
  }
  return (correctAnswers / totalExercises) * 100;
}

/**
 * Apply a delta (increment/decrement) to attempt aggregates.
 *
 * Delta means "how much the values changed" compared to the previous state.
 * Example: if an answer is deleted, deltaAnsweredCount = -1.
 */
export function applyAttemptAggregatesDelta({
  attempt,
  deltaAnsweredCount,
  deltaCorrectAnswers,
  deltaTotalTime,
}: {
  attempt: ExerciseAttemptAggregates;
  deltaAnsweredCount: number;
  deltaCorrectAnswers: number;
  deltaTotalTime: number;
}): ExerciseAttemptAggregatesPatch {
  const answeredCount = clampNumber({
    value: attempt.answeredCount + deltaAnsweredCount,
    min: 0,
    max: attempt.totalExercises,
  });
  const correctAnswers = clampNumber({
    value: attempt.correctAnswers + deltaCorrectAnswers,
    min: 0,
    max: attempt.totalExercises,
  });
  const totalTime = Math.max(0, attempt.totalTime + deltaTotalTime);

  return {
    answeredCount,
    correctAnswers,
    totalTime,
    scorePercentage: calculateScorePercentage({
      correctAnswers,
      totalExercises: attempt.totalExercises,
    }),
  };
}

/**
 * Compute an attempt duration to use for stats.
 * Prefers the denormalized totalTime (seconds) when available.
 */
export function computeAttemptDurationSeconds({
  totalTimeSeconds,
  startedAtMs,
  completedAtMs,
}: {
  totalTimeSeconds: number;
  startedAtMs: number;
  completedAtMs: number;
}): number {
  if (totalTimeSeconds > 0) {
    return Math.max(0, Math.round(totalTimeSeconds));
  }
  return Math.max(0, Math.round((completedAtMs - startedAtMs) / 1000));
}

/**
 * Incrementally update stats averages (O(1), no unbounded reads).
 */
export function computeAttemptStatsUpsert({
  existing,
  scorePercentage,
  durationSeconds,
  completedAtMs,
  mode,
  now,
}: {
  existing: ExerciseAttemptStatsCore | null;
  scorePercentage: number;
  durationSeconds: number;
  completedAtMs: number;
  mode: ExerciseAttemptMode;
  now: number;
}): ExerciseAttemptStatsPatch {
  if (!existing) {
    return {
      totalAttempts: 1,
      bestScore: scorePercentage,
      averageScore: scorePercentage,
      bestTimeSeconds: durationSeconds,
      averageTimeSeconds: durationSeconds,
      lastAttemptAt: completedAtMs,
      lastAttemptMode: mode,
      updatedAt: now,
    };
  }

  const totalAttempts = existing.totalAttempts + 1;
  const averageScore =
    (existing.averageScore * existing.totalAttempts + scorePercentage) /
    totalAttempts;
  const averageTimeSeconds =
    (existing.averageTimeSeconds * existing.totalAttempts + durationSeconds) /
    totalAttempts;

  const bestTimeSeconds =
    existing.bestTimeSeconds > 0
      ? Math.min(existing.bestTimeSeconds, durationSeconds)
      : durationSeconds;

  return {
    totalAttempts,
    bestScore: Math.max(existing.bestScore, scorePercentage),
    averageScore,
    bestTimeSeconds,
    averageTimeSeconds,
    lastAttemptAt: completedAtMs,
    lastAttemptMode: mode,
    updatedAt: now,
  };
}
