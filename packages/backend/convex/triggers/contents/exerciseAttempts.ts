import { internal } from "@repo/backend/convex/_generated/api";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
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

  if (change.operation === "insert" && newAttempt) {
    await captureProductEvent(ctx, {
      distinctId: newAttempt.userId,
      event: {
        name: "exercise attempt started",
        properties: {
          exercise_number: newAttempt.exerciseNumber,
          mode: newAttempt.mode,
          origin: newAttempt.origin,
          scope: newAttempt.scope,
          slug: newAttempt.slug,
          total_exercises: newAttempt.totalExercises,
        },
      },
      timestamp: new Date(newAttempt.startedAt),
    });
  }

  if (
    change.operation === "update" &&
    oldAttempt?.status !== "completed" &&
    newAttempt?.status === "completed"
  ) {
    await captureProductEvent(ctx, {
      distinctId: newAttempt.userId,
      event: {
        name: "exercise attempt completed",
        properties: {
          answered_count: newAttempt.answeredCount,
          correct_answers: newAttempt.correctAnswers,
          mode: newAttempt.mode,
          origin: newAttempt.origin,
          score_percentage: newAttempt.scorePercentage,
          scope: newAttempt.scope,
          slug: newAttempt.slug,
          total_exercises: newAttempt.totalExercises,
          total_time: newAttempt.totalTime,
        },
      },
      timestamp:
        newAttempt.completedAt === null
          ? undefined
          : new Date(newAttempt.completedAt),
    });
  }

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
    internal.irt.mutations.internal.responses
      .syncCalibrationResponsesForAttempt,
    {
      attemptId,
    }
  );
}
