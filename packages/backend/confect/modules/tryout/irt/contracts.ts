import type { WorkflowArgs, WorkflowId } from "@convex-dev/workflow";
import type { RegisteredMutation } from "convex/server";
import { v } from "convex/values";

/**
 * Workflow component validator for the 2PL calibration job.
 *
 * @see https://confect.dev/server/plain-convex-functions
 * @see https://www.convex.dev/components/workflow
 */
export const calibrateSetTwoPLArgs = {
  calibrationRunId: v.id("irtCalibrationRuns"),
  setId: v.id("exerciseSets"),
};

/** Native Workflow mutation type consumed by the Confect plain-function spec. */
export type CalibrateSetTwoPLWorkflow = RegisteredMutation<
  "internal",
  WorkflowArgs<typeof calibrateSetTwoPLArgs>,
  WorkflowId
>;
