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
    tryoutSectionId: v.id("tryoutSections"),
    tryoutSectionAttemptId: v.id("tryoutSectionAttempts"),
    enqueuedAt: v.number(),
  })
    .index("by_enqueuedAt", ["enqueuedAt"])
    .index("by_tryoutSectionId_and_enqueuedAt", [
      "tryoutSectionId",
      "enqueuedAt",
    ])
    .index("by_tryoutSectionAttemptId_and_enqueuedAt", [
      "tryoutSectionAttemptId",
      "enqueuedAt",
    ]),

  irtCalibrationAttempts: defineTable({
    tryoutSectionId: v.id("tryoutSections"),
    tryoutSectionAttemptId: v.id("tryoutSectionAttempts"),
    responses: v.array(
      v.object({
        questionId: v.id("questions"),
        isCorrect: v.boolean(),
      })
    ),
  })
    .index("by_tryoutSectionId", ["tryoutSectionId"])
    .index("by_tryoutSectionAttemptId", ["tryoutSectionAttemptId"])
    .index("by_tryoutSectionId_and_tryoutSectionAttemptId", [
      "tryoutSectionId",
      "tryoutSectionAttemptId",
    ]),

  irtCalibrationCacheStats: defineTable({
    tryoutSectionId: v.id("tryoutSections"),
    attemptCount: v.number(),
    updatedAt: v.number(),
  }).index("by_tryoutSectionId", ["tryoutSectionId"]),

  irtScaleQualityChecks: defineTable({
    tryoutSetId: v.id("tryoutSets"),
    status: irtScaleQualityStatusValidator,
    blockingReason: v.union(v.string(), v.null()),
    totalQuestionCount: v.number(),
    calibratedQuestionCount: v.number(),
    staleQuestionCount: v.number(),
    minAttemptCount: v.number(),
    liveWindowStartAt: v.number(),
    checkedAt: v.number(),
  }).index("by_tryoutSetId", ["tryoutSetId"]),

  irtScaleQualityRefreshQueue: defineTable({
    tryoutSetId: v.id("tryoutSets"),
    enqueuedAt: v.number(),
    processingStartedAt: v.optional(v.number()),
  })
    .index("by_enqueuedAt", ["enqueuedAt"])
    .index("by_processingStartedAt_and_enqueuedAt", [
      "processingStartedAt",
      "enqueuedAt",
    ])
    .index("by_tryoutSetId", ["tryoutSetId"]),

  irtScalePublicationQueue: defineTable({
    tryoutSetId: v.id("tryoutSets"),
    enqueuedAt: v.number(),
  })
    .index("by_enqueuedAt", ["enqueuedAt"])
    .index("by_tryoutSetId_and_enqueuedAt", ["tryoutSetId", "enqueuedAt"]),

  irtScaleVersions: defineTable({
    tryoutSetId: v.id("tryoutSets"),
    model: irtOperationalModelValidator,
    status: irtScaleVersionStatusValidator,
    questionCount: v.number(),
    publishedAt: v.number(),
  }).index("by_tryoutSetId_and_publishedAt", ["tryoutSetId", "publishedAt"]),

  irtScaleItems: defineTable({
    scaleVersionId: v.id("irtScaleVersions"),
    calibrationRunId: v.id("irtCalibrationRuns"),
    questionId: v.id("questions"),
    questionSourceKey: v.string(),
    sourceRevision: v.string(),
    contentHash: v.string(),
    difficulty: v.number(),
    discrimination: v.number(),
    responseCount: v.number(),
    correctRate: v.number(),
    calibrationStatus: irtCalibrationStatusValidator,
  })
    .index("by_scaleVersionId_and_questionSourceKey", [
      "scaleVersionId",
      "questionSourceKey",
    ])
    .index("by_questionSourceKey_and_sourceRevision", [
      "questionSourceKey",
      "sourceRevision",
    ])
    .index("by_calibrationStatus", ["calibrationStatus"]),

  irtCalibrationRuns: defineTable({
    tryoutSectionId: v.id("tryoutSections"),
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
    .index("by_tryoutSectionId_and_startedAt", ["tryoutSectionId", "startedAt"])
    .index("by_tryoutSectionId_and_status_and_startedAt", [
      "tryoutSectionId",
      "status",
      "startedAt",
    ]),
};

export default tables;
