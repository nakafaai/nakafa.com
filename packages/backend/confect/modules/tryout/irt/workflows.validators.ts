import type { WorkflowArgs, WorkflowId } from "@convex-dev/workflow";
import type { RegisteredMutation } from "convex/server";
import { v } from "convex/values";

export const calibrateSetTwoPLWorkflowArgs = {
  calibrationRunId: v.id("irtCalibrationRuns"),
  setId: v.id("exerciseSets"),
};

export const calibrateSetTwoPLWorkflowReturns = v.null();

export type CalibrateSetTwoPLWorkflow = RegisteredMutation<
  "internal",
  WorkflowArgs<typeof calibrateSetTwoPLWorkflowArgs>,
  WorkflowId
>;
