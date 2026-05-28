import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { Schema } from "effect";

export const irtCalibrationStatusSchema = Schema.Literal(
  "provisional",
  "emerging",
  "calibrated"
);

export type IrtCalibrationStatus = Schema.Schema.Type<
  typeof irtCalibrationStatusSchema
>;

export const irtCalibrationRunStatusSchema = Schema.Literal(
  "running",
  "completed",
  "failed"
);

export type IrtCalibrationRunStatus = Schema.Schema.Type<
  typeof irtCalibrationRunStatusSchema
>;

export const irtScaleVersionStatusSchema = Schema.Literal(
  "provisional",
  "official"
);

export type IrtScaleVersionStatus = Schema.Schema.Type<
  typeof irtScaleVersionStatusSchema
>;

export const irtScaleQualityStatusSchema = Schema.Literal("passed", "blocked");

export type IrtScaleQualityStatus = Schema.Schema.Type<
  typeof irtScaleQualityStatusSchema
>;

export const irtOperationalModelSchema = Schema.Literal("2pl");

export type IrtOperationalModel = Schema.Schema.Type<
  typeof irtOperationalModelSchema
>;

/** irtCalibrationQueue table definition. */
export const IrtCalibrationQueue = Table.make(
  "irtCalibrationQueue",
  Schema.Struct({
    setId: GenericId.GenericId("exerciseSets"),
    attemptId: GenericId.GenericId("exerciseAttempts"),
    enqueuedAt: Schema.Number,
  })
)
  .index("by_enqueuedAt", ["enqueuedAt"])
  .index("by_setId_and_enqueuedAt", ["setId", "enqueuedAt"])
  .index("by_attemptId_and_enqueuedAt", ["attemptId", "enqueuedAt"]);

/** irtCalibrationAttempts table definition. */
export const IrtCalibrationAttempts = Table.make(
  "irtCalibrationAttempts",
  Schema.Struct({
    setId: GenericId.GenericId("exerciseSets"),
    attemptId: GenericId.GenericId("exerciseAttempts"),
    responses: Schema.Array(
      Schema.Struct({
        questionId: GenericId.GenericId("exerciseQuestions"),
        isCorrect: Schema.Boolean,
      })
    ),
  })
)
  .index("by_setId", ["setId"])
  .index("by_setId_and_attemptId", ["setId", "attemptId"])
  .index("by_attemptId", ["attemptId"]);

/** irtCalibrationCacheStats table definition. */
export const IrtCalibrationCacheStats = Table.make(
  "irtCalibrationCacheStats",
  Schema.Struct({
    setId: GenericId.GenericId("exerciseSets"),
    attemptCount: Schema.Number,
    updatedAt: Schema.Number,
  })
).index("by_setId", ["setId"]);

/** irtScaleQualityChecks table definition. */
export const IrtScaleQualityChecks = Table.make(
  "irtScaleQualityChecks",
  Schema.Struct({
    tryoutId: GenericId.GenericId("tryouts"),
    status: irtScaleQualityStatusSchema,
    blockingReason: Schema.Union(Schema.String, Schema.Null),
    totalQuestionCount: Schema.Number,
    calibratedQuestionCount: Schema.Number,
    staleQuestionCount: Schema.Number,
    minAttemptCount: Schema.Number,
    liveWindowStartAt: Schema.Number,
    checkedAt: Schema.Number,
  })
).index("by_tryoutId", ["tryoutId"]);

/** irtScaleQualityRefreshQueue table definition. */
export const IrtScaleQualityRefreshQueue = Table.make(
  "irtScaleQualityRefreshQueue",
  Schema.Struct({
    tryoutId: GenericId.GenericId("tryouts"),
    enqueuedAt: Schema.Number,
    processingStartedAt: Schema.optional(Schema.Number),
  })
)
  .index("by_enqueuedAt", ["enqueuedAt"])
  .index("by_processingStartedAt_and_enqueuedAt", [
    "processingStartedAt",
    "enqueuedAt",
  ])
  .index("by_tryoutId", ["tryoutId"]);

/** irtScalePublicationQueue table definition. */
export const IrtScalePublicationQueue = Table.make(
  "irtScalePublicationQueue",
  Schema.Struct({
    tryoutId: GenericId.GenericId("tryouts"),
    enqueuedAt: Schema.Number,
  })
)
  .index("by_enqueuedAt", ["enqueuedAt"])
  .index("by_tryoutId_and_enqueuedAt", ["tryoutId", "enqueuedAt"]);

/** irtScaleVersions table definition. */
export const IrtScaleVersions = Table.make(
  "irtScaleVersions",
  Schema.Struct({
    tryoutId: GenericId.GenericId("tryouts"),
    model: irtOperationalModelSchema,
    status: irtScaleVersionStatusSchema,
    questionCount: Schema.Number,
    publishedAt: Schema.Number,
  })
).index("by_tryoutId_and_publishedAt", ["tryoutId", "publishedAt"]);

/** irtScaleVersionItems table definition. */
export const IrtScaleVersionItems = Table.make(
  "irtScaleVersionItems",
  Schema.Struct({
    scaleVersionId: GenericId.GenericId("irtScaleVersions"),
    calibrationRunId: GenericId.GenericId("irtCalibrationRuns"),
    questionId: GenericId.GenericId("exerciseQuestions"),
    setId: GenericId.GenericId("exerciseSets"),
    difficulty: Schema.Number,
    discrimination: Schema.Number,
  })
).index("by_scaleVersionId_and_setId_and_questionId", [
  "scaleVersionId",
  "setId",
  "questionId",
]);

/** irtCalibrationRuns table definition. */
export const IrtCalibrationRuns = Table.make(
  "irtCalibrationRuns",
  Schema.Struct({
    setId: GenericId.GenericId("exerciseSets"),
    model: irtOperationalModelSchema,
    status: irtCalibrationRunStatusSchema,
    questionCount: Schema.Number,
    responseCount: Schema.Number,
    attemptCount: Schema.Number,
    iterationCount: Schema.Number,
    maxParameterDelta: Schema.Number,
    startedAt: Schema.Number,
    updatedAt: Schema.Number,
    completedAt: Schema.optional(Schema.Number),
    error: Schema.optional(Schema.String),
  })
)
  .index("by_setId_and_startedAt", ["setId", "startedAt"])
  .index("by_setId_and_status_and_startedAt", ["setId", "status", "startedAt"]);

/** exerciseItemParameters table definition. */
export const ExerciseItemParameters = Table.make(
  "exerciseItemParameters",
  Schema.Struct({
    questionId: GenericId.GenericId("exerciseQuestions"),
    setId: GenericId.GenericId("exerciseSets"),
    difficulty: Schema.Number,
    discrimination: Schema.Number,
    responseCount: Schema.Number,
    correctRate: Schema.Number,
    calibratedAt: Schema.Number,
    calibrationStatus: irtCalibrationStatusSchema,
    calibrationRunId: Schema.optional(
      GenericId.GenericId("irtCalibrationRuns")
    ),
  })
)
  .index("by_questionId", ["questionId"])
  .index("by_setId", ["setId"])
  .index("by_calibrationStatus", ["calibrationStatus"]);

export const tables = [
  IrtCalibrationQueue,
  IrtCalibrationAttempts,
  IrtCalibrationCacheStats,
  IrtScaleQualityChecks,
  IrtScaleQualityRefreshQueue,
  IrtScalePublicationQueue,
  IrtScaleVersions,
  IrtScaleVersionItems,
  IrtCalibrationRuns,
  ExerciseItemParameters,
] as const;
