import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { irtCalibrationSyncWorkpool } from "@repo/backend/convex/irt/workpool";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Keeps denormalized IRT calibration responses in sync with completed simulation
 * set attempts.
 */
export async function exerciseAttemptsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "exerciseAttempts">
) {
  const newAttempt = change.newDoc;
  const oldAttempt = change.oldDoc;
  const attemptId = newAttempt?._id ?? oldAttempt?._id;

  if (!attemptId) {
    return;
  }

  const hadCalibrationResponses = oldAttempt
    ? oldAttempt.scope === "set" &&
      oldAttempt.mode === "simulation" &&
      oldAttempt.status === "completed"
    : false;
  const hasCalibrationResponses = newAttempt
    ? newAttempt.scope === "set" &&
      newAttempt.mode === "simulation" &&
      newAttempt.status === "completed"
    : false;

  if (!(hadCalibrationResponses || hasCalibrationResponses)) {
    return;
  }

  if (
    change.operation === "update" &&
    hadCalibrationResponses === hasCalibrationResponses
  ) {
    return;
  }

  await irtCalibrationSyncWorkpool.enqueueMutation(
    ctx,
    internal.irt.internalMutations.syncCalibrationResponsesForAttempt,
    {
      attemptId,
    }
  );
}
