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

export const irtOperationalModelValidator = literals("2pl");

const tables = {
  irtCalibrationQueue: defineTable({
    setId: v.id("exerciseSets"),
    enqueuedAt: v.number(),
  })
    .index("enqueuedAt", ["enqueuedAt"])
    .index("setId_enqueuedAt", ["setId", "enqueuedAt"]),

  irtScalePublicationQueue: defineTable({
    tryoutId: v.id("snbtTryouts"),
    enqueuedAt: v.number(),
  })
    .index("enqueuedAt", ["enqueuedAt"])
    .index("tryoutId_enqueuedAt", ["tryoutId", "enqueuedAt"]),

  irtScaleVersions: defineTable({
    tryoutId: v.id("snbtTryouts"),
    model: irtOperationalModelValidator,
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
  }).index("setId_startedAt", ["setId", "startedAt"]),

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
