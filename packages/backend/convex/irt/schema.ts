import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const irtCalibrationStatusValidator = literals(
  "provisional",
  "emerging",
  "calibrated"
);

export const irtCalibrationRunStatusValidator = literals(
  "running",
  "completed",
  "failed"
);

export const irtScaleVersionStatusValidator = literals(
  "provisional",
  "official"
);

export const irtScaleQualityStatusValidator = literals("passed", "blocked");

export const irtOperationalModelValidator = literals("2pl");

const tables = {
  irtCalibrationQueue: defineTable({
    setId: v.id("exerciseSets"),
    attemptId: v.id("exerciseAttempts"),
    enqueuedAt: v.number(),
  })
    .index("by_enqueuedAt", ["enqueuedAt"])
    .index("by_setId_and_enqueuedAt", ["setId", "enqueuedAt"])
    .index("by_attemptId_and_enqueuedAt", ["attemptId", "enqueuedAt"]),

  irtCalibrationAttempts: defineTable({
    setId: v.id("exerciseSets"),
    attemptId: v.id("exerciseAttempts"),
    responses: v.array(
      v.object({
        questionId: v.id("exerciseQuestions"),
        isCorrect: v.boolean(),
      })
    ),
  })
    .index("by_setId", ["setId"])
    .index("by_setId_and_attemptId", ["setId", "attemptId"])
    .index("by_attemptId", ["attemptId"]),

  irtCalibrationCacheStats: defineTable({
    setId: v.id("exerciseSets"),
    attemptCount: v.number(),
    updatedAt: v.number(),
  }).index("by_setId", ["setId"]),

  irtScaleQualityChecks: defineTable({
    tryoutId: v.id("tryouts"),
    status: irtScaleQualityStatusValidator,
    blockingReason: v.union(v.string(), v.null()),
    totalQuestionCount: v.number(),
    calibratedQuestionCount: v.number(),
    staleQuestionCount: v.number(),
    minAttemptCount: v.number(),
    liveWindowStartAt: v.number(),
    checkedAt: v.number(),
  }).index("by_tryoutId", ["tryoutId"]),

  irtScaleQualityRefreshQueue: defineTable({
    tryoutId: v.id("tryouts"),
    enqueuedAt: v.number(),
    processingStartedAt: v.optional(v.number()),
  })
    .index("by_enqueuedAt", ["enqueuedAt"])
    .index("by_processingStartedAt_and_enqueuedAt", [
      "processingStartedAt",
      "enqueuedAt",
    ])
    .index("by_tryoutId", ["tryoutId"]),

  irtScalePublicationQueue: defineTable({
    tryoutId: v.id("tryouts"),
    enqueuedAt: v.number(),
  })
    .index("by_enqueuedAt", ["enqueuedAt"])
    .index("by_tryoutId_and_enqueuedAt", ["tryoutId", "enqueuedAt"]),

  irtScaleVersions: defineTable({
    tryoutId: v.id("tryouts"),
    model: irtOperationalModelValidator,
    status: irtScaleVersionStatusValidator,
    questionCount: v.number(),
    publishedAt: v.number(),
  }).index("by_tryoutId_and_publishedAt", ["tryoutId", "publishedAt"]),

  irtScaleVersionItems: defineTable({
    scaleVersionId: v.id("irtScaleVersions"),
    calibrationRunId: v.id("irtCalibrationRuns"),
    questionId: v.id("exerciseQuestions"),
    setId: v.id("exerciseSets"),
    difficulty: v.number(),
    discrimination: v.number(),
  }).index("by_scaleVersionId_and_setId_and_questionId", [
    "scaleVersionId",
    "setId",
    "questionId",
  ]),

  irtCalibrationRuns: defineTable({
    setId: v.id("exerciseSets"),
    model: irtOperationalModelValidator,
    status: irtCalibrationRunStatusValidator,
    questionCount: v.number(),
    responseCount: v.number(),
    attemptCount: v.number(),
    iterationCount: v.number(),
    maxParameterDelta: v.number(),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_setId_and_startedAt", ["setId", "startedAt"])
    .index("by_setId_and_status_and_startedAt", [
      "setId",
      "status",
      "startedAt",
    ]),

  exerciseItemParameters: defineTable({
    questionId: v.id("exerciseQuestions"),
    setId: v.id("exerciseSets"),
    /** 2PL difficulty parameter (b). */
    difficulty: v.number(),
    /** 2PL discrimination parameter (a). */
    discrimination: v.number(),
    responseCount: v.number(),
    correctRate: v.number(),
    calibratedAt: v.number(),
    calibrationStatus: irtCalibrationStatusValidator,
    calibrationRunId: v.optional(v.id("irtCalibrationRuns")),
  })
    .index("by_questionId", ["questionId"])
    .index("by_setId", ["setId"])
    .index("by_calibrationStatus", ["calibrationStatus"]),
};

export default tables;
