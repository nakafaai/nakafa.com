import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  buildCalibrationAttemptInsert,
  clearCalibrationResponsesForAttempt,
  insertCalibrationAttempt,
} from "@repo/backend/confect/modules/tryout/irtAttempts.service";
import {
  ensurePendingCalibrationQueueEntry,
  removePendingCalibrationQueueEntry,
} from "@repo/backend/confect/modules/tryout/irtQueueHelpers.service";
import { Clock, Effect } from "effect";

/** Rebuilds cached IRT responses for one completed exercise attempt. */
export const syncCalibrationResponsesForAttempt = Effect.fn(
  "irt.responses.syncCalibrationResponsesForAttempt"
)(function* (args: { readonly attemptId: Id<"exerciseAttempts"> }) {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;

  yield* clearCalibrationResponsesForAttempt(ctx, {
    attemptId: args.attemptId,
    updatedAt: now,
  });

  const calibrationAttempt = yield* buildCalibrationAttemptInsert(
    ctx,
    args.attemptId
  );

  if (!calibrationAttempt) {
    yield* removePendingCalibrationQueueEntry(ctx, args.attemptId);
    return null;
  }

  yield* insertCalibrationAttempt(ctx, {
    attemptId: args.attemptId,
    responses: calibrationAttempt.responses,
    setId: calibrationAttempt.setId,
    updatedAt: now,
  });
  yield* ensurePendingCalibrationQueueEntry(ctx, {
    attemptId: args.attemptId,
    enqueuedAt: now,
    setId: calibrationAttempt.setId,
  });

  return null;
});
