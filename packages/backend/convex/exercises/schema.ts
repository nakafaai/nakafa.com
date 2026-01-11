import { defineTable } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

// How the attempt is intended to be used (affects timer + UX).
export const exerciseAttemptMode = v.union(
  v.literal("practice"),
  v.literal("simulation")
);
export type ExerciseAttemptMode = Infer<typeof exerciseAttemptMode>;

export const exerciseAttemptScope = v.union(
  v.literal("set"),
  v.literal("single")
);
export type ExerciseAttemptScope = Infer<typeof exerciseAttemptScope>;

// Attempt lifecycle state.
export const exerciseAttemptStatus = v.union(
  v.literal("in-progress"),
  v.literal("completed"),
  v.literal("expired"),
  v.literal("abandoned")
);
export type ExerciseAttemptStatus = Infer<typeof exerciseAttemptStatus>;

const tables = {
  exerciseAttempts: defineTable({
    // Clean set path (no leading/trailing "/"), same idea as comments.slug (e.g. "exercises/.../try-out/set-1").
    slug: v.string(),
    userId: v.id("users"),
    mode: exerciseAttemptMode,

    // "set" = whole set attempt; "single" = one exercise inside a set.
    scope: exerciseAttemptScope,

    // Only set when scope === "single".
    exerciseNumber: v.optional(v.number()),

    // Time limits are in seconds.
    timeLimit: v.number(),
    perQuestionTimeLimit: v.optional(v.number()),
    // ID of scheduled expiry job for cancellation.
    schedulerId: v.optional(v.id("_scheduled_functions")),

    // Timestamps are epoch millis.
    startedAt: v.number(),
    lastActivityAt: v.number(),
    completedAt: v.optional(v.number()),
    status: exerciseAttemptStatus,
    updatedAt: v.number(),

    // Denormalized aggregates for fast UI and low bandwidth.
    totalExercises: v.number(),
    answeredCount: v.number(),
    correctAnswers: v.number(),

    // Total time spent in this attempt (seconds).
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

    // Exercise number inside the set (1..N).
    exerciseNumber: v.number(),

    selectedOptionId: v.optional(v.string()),
    textAnswer: v.optional(v.string()),
    isCorrect: v.boolean(),

    // Time spent answering this question (seconds).
    timeSpent: v.number(),

    // Timestamp is epoch millis.
    answeredAt: v.number(),
    updatedAt: v.number(),
  }).index("attemptId_exerciseNumber", ["attemptId", "exerciseNumber"]),

  exerciseAttemptStats: defineTable({
    userId: v.id("users"),
    slug: v.string(),
    totalAttempts: v.number(),
    bestScore: v.number(),
    averageScore: v.number(),
    bestTimeSeconds: v.number(),
    averageTimeSeconds: v.number(),
    lastAttemptAt: v.number(),
    lastAttemptMode: exerciseAttemptMode,
    updatedAt: v.number(),
  })
    .index("userId_slug", ["userId", "slug"])
    .index("userId_lastAttemptAt", ["userId", "lastAttemptAt"]),
};

export default tables;
