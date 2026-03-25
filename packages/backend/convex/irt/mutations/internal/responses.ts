import { internalMutation } from "@repo/backend/convex/functions";
import {
  buildCalibrationAttemptInsert,
  clearCalibrationResponsesForAttempt,
  insertCalibrationAttempt,
} from "@repo/backend/convex/irt/helpers/attempts";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * Rebuild the cached calibration response row for one completed simulation
 * exercise attempt.
 *
 * The mutation first removes stale cache rows for the attempt, then rebuilds a
 * single normalized row from the authoritative exercise answers if the attempt
 * is still eligible for calibration.
 */
export const syncCalibrationResponsesForAttempt = internalMutation({
  args: {
    attemptId: vv.id("exerciseAttempts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    await clearCalibrationResponsesForAttempt(ctx, {
      attemptId: args.attemptId,
      updatedAt: now,
    });

    const calibrationAttempt = await buildCalibrationAttemptInsert(
      ctx,
      args.attemptId
    );

    if (!calibrationAttempt) {
      return null;
    }

    await insertCalibrationAttempt(ctx, {
      attemptId: args.attemptId,
      responses: calibrationAttempt.responses,
      setId: calibrationAttempt.setId,
      updatedAt: now,
    });

    return null;
  },
});
