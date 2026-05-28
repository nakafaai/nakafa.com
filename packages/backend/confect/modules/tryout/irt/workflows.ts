import type { WorkflowArgs, WorkflowId } from "@convex-dev/workflow";
import refs from "@repo/backend/confect/_generated/refs";
import { workflow } from "@repo/backend/confect/modules/operations/workflow";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import type { RegisteredMutation } from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

/**
 * Workflow component validator for the 2PL calibration job.
 *
 * @see https://confect.dev/server/plain-convex-functions
 * @see https://www.convex.dev/components/workflow
 */
export const calibrateSetTwoPLWorkflowArgs = {
  calibrationRunId: v.id("irtCalibrationRuns"),
  setId: v.id("exerciseSets"),
};

/** Workflow component return validator for the 2PL calibration job. */
export const calibrateSetTwoPLWorkflowReturns = v.null();

/** Registered native Workflow function type consumed by Confect refs. */
export type CalibrateSetTwoPLWorkflow = RegisteredMutation<
  "internal",
  WorkflowArgs<typeof calibrateSetTwoPLWorkflowArgs>,
  WorkflowId
>;

/** Converts an unknown workflow failure into a stable persisted error message. */
function getCalibrationErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Calibrates one exercise set and persists the resulting 2PL item parameters.
 */
export const calibrateSetTwoPL = workflow.define({
  args: calibrateSetTwoPLWorkflowArgs,
  returns: calibrateSetTwoPLWorkflowReturns,
  handler: async (step, args) =>
    await Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise(() =>
          step.runAction(
            toConvexReference(
              refs.internal.irt.actions.internalFunctions.calibration
                .calibrateSetTwoPL
            ),
            { setId: args.setId },
            { retry: true }
          )
        );

        yield* Effect.tryPromise(() =>
          step.runMutation(
            toConvexReference(
              refs.internal.irt.mutations.internalFunctions.runs
                .completeCalibrationRun
            ),
            {
              calibrationRunId: args.calibrationRunId,
              result,
            }
          )
        );

        return null;
      }).pipe(
        Effect.catchAll((error) =>
          Effect.promise(() =>
            step.runMutation(
              toConvexReference(
                refs.internal.irt.mutations.internalFunctions.runs
                  .failCalibrationRun
              ),
              {
                calibrationRunId: args.calibrationRunId,
                error: getCalibrationErrorMessage(error),
              }
            )
          ).pipe(Effect.flatMap(() => Effect.fail(error)))
        )
      )
    ),
});
