import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { attemptEndReasonSchema } from "@repo/backend/confect/modules/learning/attempts.schemas";
import { Schema } from "effect";

/**
 * Exercise attempt mode validator.
 * How the attempt is intended to be used (affects timer + UX).
 */
export const exerciseAttemptModeSchema = Schema.Literal(
  "practice",
  "simulation"
);

/**
 * Exercise attempt scope validator.
 * "set" = whole set attempt; "single" = one exercise inside a set.
 */
export const exerciseAttemptScopeSchema = Schema.Literal("set", "single");

/**
 * Exercise attempt origin validator.
 * Distinguishes standalone exercise attempts from runtime-managed tryout parts.
 */
export const exerciseAttemptOriginSchema = Schema.Literal(
  "standalone",
  "tryout"
);

/**
 * Exercise attempt status validator.
 * Attempt lifecycle state.
 */
export const exerciseAttemptStatusSchema = Schema.Literal(
  "in-progress",
  "completed",
  "expired"
);

/** exerciseAttempts table definition. */
export const ExerciseAttempts = Table.make(
  "exerciseAttempts",
  Schema.Struct({
    slug: Schema.String,
    userId: GenericId.GenericId("users"),
    origin: exerciseAttemptOriginSchema,
    mode: exerciseAttemptModeSchema,
    scope: exerciseAttemptScopeSchema,
    exerciseNumber: Schema.optional(Schema.Number),
    timeLimit: Schema.Number,
    perQuestionTimeLimit: Schema.optional(Schema.Number),
    schedulerId: Schema.optional(GenericId.GenericId("_scheduled_functions")),
    startedAt: Schema.Number,
    lastActivityAt: Schema.Number,
    completedAt: Schema.Union(Schema.Number, Schema.Null),
    endReason: Schema.Union(attemptEndReasonSchema, Schema.Null),
    status: exerciseAttemptStatusSchema,
    updatedAt: Schema.Number,
    totalExercises: Schema.Number,
    answeredCount: Schema.Number,
    correctAnswers: Schema.Number,
    totalTime: Schema.Number,
    scorePercentage: Schema.Number,
  })
)
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
  ]);

/** exerciseAnswers table definition. */
export const ExerciseAnswers = Table.make(
  "exerciseAnswers",
  Schema.Struct({
    attemptId: GenericId.GenericId("exerciseAttempts"),
    exerciseNumber: Schema.Number,
    questionId: Schema.optional(GenericId.GenericId("exerciseQuestions")),
    selectedOptionId: Schema.optional(Schema.String),
    textAnswer: Schema.optional(Schema.String),
    isCorrect: Schema.Boolean,
    timeSpent: Schema.Number,
    answeredAt: Schema.Number,
    updatedAt: Schema.Number,
  })
)
  .index("by_attemptId_and_exerciseNumber", ["attemptId", "exerciseNumber"])
  .index("by_questionId", ["questionId"]);

export const tables = [ExerciseAttempts, ExerciseAnswers] as const;
