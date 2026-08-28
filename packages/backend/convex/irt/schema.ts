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
  irtScaleVersions: defineTable({
    history: v.optional(v.literal(true)),
    tryoutSnapshotId: v.string(),
    setIdentity: v.string(),
    model: irtOperationalModelValidator,
    status: irtScaleVersionStatusValidator,
    questionCount: v.number(),
    publishedAt: v.number(),
  })
    .index("by_setIdentity_and_publishedAt", ["setIdentity", "publishedAt"])
    .index("by_tryoutSnapshotId_and_setIdentity_and_publishedAt", [
      "tryoutSnapshotId",
      "setIdentity",
      "publishedAt",
    ]),

  irtScaleItems: defineTable({
    scaleVersionId: v.id("irtScaleVersions"),
    calibrationRunId: v.id("irtCalibrationRuns"),
    placementIdentity: v.string(),
    placementRowHash: v.string(),
    difficulty: v.number(),
    discrimination: v.number(),
    responseCount: v.number(),
    correctRate: v.number(),
    calibrationStatus: irtCalibrationStatusValidator,
  })
    .index("by_calibrationRunId", ["calibrationRunId"])
    .index("by_calibrationStatus", ["calibrationStatus"])
    .index("by_scaleVersionId_and_placementIdentity", [
      "scaleVersionId",
      "placementIdentity",
    ]),

  irtCalibrationRuns: defineTable({
    scaleVersionId: v.id("irtScaleVersions"),
    sectionIdentity: v.string(),
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
  }).index("by_scaleVersionId_and_sectionIdentity_and_startedAt", [
    "scaleVersionId",
    "sectionIdentity",
    "startedAt",
  ]),
};

export default tables;
