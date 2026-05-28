import refs from "@repo/backend/confect/_generated/refs";
import { workflow } from "@repo/backend/confect/modules/operations/workflow";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { calibrateSetTwoPLArgs } from "@repo/backend/confect/modules/tryout/irt/contracts";
import { v } from "convex/values";
import { Effect } from "effect";

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
export const calibrateSetTwoPLWorkflow = workflow.define({
  args: calibrateSetTwoPLArgs,
  returns: v.null(),
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
