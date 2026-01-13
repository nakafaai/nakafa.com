import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import { clampNumber } from "../utils/helper";

type ExerciseAttemptAggregates = Pick<
  Doc<"exerciseAttempts">,
  "answeredCount" | "correctAnswers" | "totalExercises" | "totalTime"
>;

type ExerciseAttemptAggregatesPatch = Pick<
  WithoutSystemFields<Doc<"exerciseAttempts">>,
  "answeredCount" | "correctAnswers" | "totalTime" | "scorePercentage"
>;

/**
 * Calculate score percentage for an exercise attempt.
 *
 * @param correctAnswers - Number of correct answers in the attempt
 * @param totalExercises - Total number of exercises in the set
 * @returns Score as percentage (0-100)
 */
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
 * Used by trigger system to update attempt counters when answers change.
 *
 * DELTA PATTERN:
 * - Delta = how much values changed compared to previous state
 * - Example: If answer is deleted, deltaAnsweredCount = -1
 * - Example: If answer changes from incorrect to correct, deltaCorrectAnswers = 1
 *
 * RETRY SAFETY:
 * - Triggers calculate deltas from change.newDoc vs change.oldDoc
 * - This ensures correct values even if retries occur
 * - Deltas are small, deterministic numbers
 *
 * @param attempt - Current attempt state (before applying delta)
 * @param deltaAnsweredCount - Change in answered count (+1 or -1)
 * @param deltaCorrectAnswers - Change in correct answers (+1 or -1)
 * @param deltaTotalTime - Change in total time (positive or negative)
 * @returns Patch object with updated aggregates
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
 * Compute final duration of an exercise attempt for statistics.
 *
 * CALCULATION METHOD: Uses wall-clock time (completedAt - startedAt).
 *
 * WHY WALL-CLOCK TIME (IMPORTANT):
 * ========================================
 * Per-question time tracking (in exerciseAnswers.timeSpent) only counts
 * time when a question is 75%+ visible on the screen. This design
 * intentionally tracks "active engagement time" but misses:
 *   - Thinking periods when scrolling between questions
 *   - Tab switches / browser minimization
 *   - Pauses to read reference materials
 *   - Breaks away from the exercise
 *
 * Wall-clock time captures ALL periods from start to finish, matching
 * user expectations for "total time spent on this attempt".
 *
 * RELATIONSHIP TO TRIGGER SYSTEM:
 * ================================
 * - During attempt: totalTime accumulates via trigger from per-question timeSpent
 * - On completion: Final duration recalculated to wall-clock time
 * - This ensures stored duration includes idle periods
 *
 * @param startedAtMs - Attempt start timestamp (epoch millis)
 * @param completedAtMs - Attempt completion/expiration timestamp (epoch millis)
 * @returns Final duration in seconds (rounded, never negative)
 */
export function computeAttemptDurationSeconds({
  startedAtMs,
  completedAtMs,
}: {
  startedAtMs: number;
  completedAtMs: number;
}): number {
  const wallClockSeconds = (completedAtMs - startedAtMs) / 1000;

  return Math.max(0, Math.round(wallClockSeconds));
}
