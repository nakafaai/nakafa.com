import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retireAttempt } from "@repo/backend/convex/retirement/impl";
import {
  planValidator,
  REVIEWED_ATTEMPT_ID,
  requireProof,
} from "@repo/backend/convex/retirement/spec";
import { v } from "convex/values";
import { Effect } from "effect";

/** Temporary internal operation, removed immediately after the reviewed retirement. */
export const emptyAttempt = internalMutation({
  args: { plan: planValidator },
  returns: v.object({
    alreadyRetired: v.boolean(),
    retiredAttemptId: v.id("tryoutAttempts"),
    restoredAttemptId: v.id("tryoutAttempts"),
    restoredProgressId: v.id("tryoutSetProgress"),
    removedSections: v.number(),
    removedPlacements: v.number(),
  }),
  handler: (ctx, { plan }) =>
    runConvexProgram(
      Effect.gen(function* () {
        yield* requireProof(
          plan.attempt._id === REVIEWED_ATTEMPT_ID,
          "Only the reviewed production attempt may be retired."
        );
        return yield* retireAttempt(ctx, plan);
      })
    ),
});
