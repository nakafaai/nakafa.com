import { attemptEndReasonValidator } from "@repo/backend/convex/lib/attempts";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Exercise attempt mode validator.
 * How the attempt is intended to be used (affects timer + UX).
 */
export const exerciseAttemptModeValidator = literals("practice", "simulation");

/**
 * Exercise attempt scope validator.
 * "set" = whole set attempt; "single" = one exercise inside a set.
 */
export const exerciseAttemptScopeValidator = literals("set", "single");

/**
 * Exercise attempt origin validator.
 * Distinguishes standalone exercise attempts from runtime-managed tryout parts.
 */
export const exerciseAttemptOriginValidator = literals("standalone", "tryout");

/**
 * Exercise attempt status validator.
 * Attempt lifecycle state.
 */
export const exerciseAttemptStatusValidator = literals(
  "in-progress",
  "completed",
  "expired"
);

const tables = {
  exerciseAttempts: defineTable({
    slug: v.string(),
    userId: v.id("users"),
    origin: exerciseAttemptOriginValidator,
    mode: exerciseAttemptModeValidator,
    scope: exerciseAttemptScopeValidator,
    exerciseNumber: v.optional(v.number()),
    timeLimit: v.number(),
    perQuestionTimeLimit: v.optional(v.number()),
    schedulerId: v.optional(v.id("_scheduled_functions")),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    completedAt: v.union(v.number(), v.null()),
    endReason: v.union(attemptEndReasonValidator, v.null()),
    status: exerciseAttemptStatusValidator,
    updatedAt: v.number(),
    totalExercises: v.number(),
    answeredCount: v.number(),
    correctAnswers: v.number(),
    totalTime: v.number(),
    scorePercentage: v.number(),
  })
    .index("by_userId_and_origin_and_slug_and_scope_and_startedAt", [
      "userId",
      "origin",
      "slug",
      "scope",
      "startedAt",
    ])
    .index("by_scope_and_mode_and_status_and_startedAt", [
      "scope",
      "mode",
      "status",
      "startedAt",
    ]),

  exerciseAnswers: defineTable({
    attemptId: v.id("exerciseAttempts"),
    exerciseNumber: v.number(),
    /** Populated by server-authoritative scoring on all new writes. */
    questionId: v.optional(v.id("exerciseQuestions")),
    /** Canonical choice key selected by the user. */
    selectedOptionId: v.optional(v.string()),
    textAnswer: v.optional(v.string()),
    isCorrect: v.boolean(),
    timeSpent: v.number(),
    answeredAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_attemptId_and_exerciseNumber", ["attemptId", "exerciseNumber"])
    .index("by_questionId", ["questionId"]),
};

export default tables;
