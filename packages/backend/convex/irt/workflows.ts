import { internal } from "@repo/backend/convex/_generated/api";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

const calibrationWorkflowReturnValidator = v.null();

/**
 * Durable workflow that calibrates one exercise set and persists the resulting
 * 2PL item parameters.
 */
export const calibrateSetTwoPL = workflow.define({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    setId: vv.id("exerciseSets"),
  },
  returns: calibrationWorkflowReturnValidator,
  handler: async (step, args) => {
    try {
      const result = await step.runAction(
        internal.irt.actions.internal.calibration.calibrateSetTwoPL,
        { setId: args.setId },
        { retry: true }
      );

      await step.runMutation(
        internal.irt.mutations.internal.runs.completeCalibrationRun,
        {
          calibrationRunId: args.calibrationRunId,
          result,
        }
      );

      return null;
    } catch (error) {
      await step.runMutation(
        internal.irt.mutations.internal.runs.failCalibrationRun,
        {
          calibrationRunId: args.calibrationRunId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      throw error;
    }
  },
});
