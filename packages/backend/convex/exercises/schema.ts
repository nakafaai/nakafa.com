import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Exercise attempt mode validator.
 * How the attempt is intended to be used (affects timer + UX).
 */
export const exerciseAttemptModeValidator = literals("practice", "simulation");
export type ExerciseAttemptMode = Infer<typeof exerciseAttemptModeValidator>;

/**
 * Exercise attempt scope validator.
 * "set" = whole set attempt; "single" = one exercise inside a set.
 */
export const exerciseAttemptScopeValidator = literals("set", "single");
export type ExerciseAttemptScope = Infer<typeof exerciseAttemptScopeValidator>;

/**
 * Exercise attempt status validator.
 * Attempt lifecycle state.
 */
export const exerciseAttemptStatusValidator = literals(
  "in-progress",
  "completed",
  "expired",
  "abandoned"
);
export type ExerciseAttemptStatus = Infer<
  typeof exerciseAttemptStatusValidator
>;

const tables = {
  exerciseAttempts: defineTable({
    slug: v.string(),
    userId: v.id("users"),
    mode: exerciseAttemptModeValidator,
    scope: exerciseAttemptScopeValidator,
    exerciseNumber: v.optional(v.number()),
    timeLimit: v.number(),
    perQuestionTimeLimit: v.optional(v.number()),
    schedulerId: v.optional(v.id("_scheduled_functions")),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    completedAt: v.optional(v.number()),
    status: exerciseAttemptStatusValidator,
    updatedAt: v.number(),
    totalExercises: v.number(),
    answeredCount: v.number(),
    correctAnswers: v.number(),
    totalTime: v.number(),
    scorePercentage: v.number(),
  }).index("userId_slug_scope_startedAt", [
    "userId",
    "slug",
    "scope",
    "startedAt",
  ]),

  exerciseAnswers: defineTable({
    attemptId: v.id("exerciseAttempts"),
    exerciseNumber: v.number(),
    selectedOptionId: v.optional(v.string()),
    textAnswer: v.optional(v.string()),
    isCorrect: v.boolean(),
    timeSpent: v.number(),
    answeredAt: v.number(),
    updatedAt: v.number(),
  }).index("attemptId_exerciseNumber", ["attemptId", "exerciseNumber"]),
};

export default tables;
