import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const irtCalibrationStatusValidator = literals(
  "provisional",
  "emerging",
  "calibrated"
);

const tables = {
  exerciseItemParameters: defineTable({
    questionId: v.id("exerciseQuestions"),
    setId: v.id("exerciseSets"),
    difficulty: v.number(),
    discrimination: v.number(),
    guessing: v.number(),
    responseCount: v.number(),
    correctRate: v.number(),
    calibratedAt: v.number(),
    calibrationStatus: irtCalibrationStatusValidator,
  })
    .index("questionId", ["questionId"])
    .index("setId", ["setId"])
    .index("calibrationStatus", ["calibrationStatus"]),
};

export default tables;
