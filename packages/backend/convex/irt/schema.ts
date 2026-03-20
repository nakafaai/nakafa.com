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

export const irtOperationalModelValidator = literals("2pl");

const tables = {
  irtCalibrationQueue: defineTable({
    setId: v.id("exerciseSets"),
    enqueuedAt: v.number(),
  })
    .index("enqueuedAt", ["enqueuedAt"])
    .index("setId_enqueuedAt", ["setId", "enqueuedAt"]),

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
    .index("setId_attemptId", ["setId", "attemptId"])
    .index("attemptId", ["attemptId"]),

  irtScalePublicationQueue: defineTable({
    tryoutId: v.id("tryouts"),
    enqueuedAt: v.number(),
  })
    .index("enqueuedAt", ["enqueuedAt"])
    .index("tryoutId_enqueuedAt", ["tryoutId", "enqueuedAt"]),

  irtScaleVersions: defineTable({
    tryoutId: v.id("tryouts"),
    model: irtOperationalModelValidator,
    status: irtScaleVersionStatusValidator,
    questionCount: v.number(),
    publishedAt: v.number(),
  }).index("tryoutId_publishedAt", ["tryoutId", "publishedAt"]),

  irtScaleVersionItems: defineTable({
    scaleVersionId: v.id("irtScaleVersions"),
    calibrationRunId: v.id("irtCalibrationRuns"),
    questionId: v.id("exerciseQuestions"),
    setId: v.id("exerciseSets"),
    difficulty: v.number(),
    discrimination: v.number(),
  }).index("scaleVersionId_setId_questionId", [
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
    .index("setId_startedAt", ["setId", "startedAt"])
    .index("setId_status_startedAt", ["setId", "status", "startedAt"]),

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
    .index("questionId", ["questionId"])
    .index("setId", ["setId"])
    .index("calibrationStatus", ["calibrationStatus"]),
};

export default tables;
