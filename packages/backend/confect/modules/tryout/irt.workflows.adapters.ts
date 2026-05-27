import { workflow } from "@repo/backend/confect/modules/operations/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import { v } from "convex/values";
import { Effect } from "effect";

const calibrationWorkflowReturnValidator = v.null();

/**
 * Durable workflow that calibrates one exercise set and persists the resulting
 * 2PL item parameters.
 */
export const calibrateSetTwoPL = workflow.define({
  args: {
    calibrationRunId: v.id("irtCalibrationRuns"),
    setId: v.id("exerciseSets"),
  },
  returns: calibrationWorkflowReturnValidator,
  handler: async (step, args) => {
    try {
      const result = await step.runAction(
        internal.irt.actions.internalFunctions.calibration.calibrateSetTwoPL,
        { setId: args.setId },
        { retry: true }
      );

      await step.runMutation(
        internal.irt.mutations.internalFunctions.runs.completeCalibrationRun,
        {
          calibrationRunId: args.calibrationRunId,
          result,
        }
      );

      return null;
    } catch (error) {
      await step.runMutation(
        internal.irt.mutations.internalFunctions.runs.failCalibrationRun,
        {
          calibrationRunId: args.calibrationRunId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return await Effect.runPromise(Effect.fail(error));
    }
  },
});
