import { internalMutation } from "@repo/backend/convex/_generated/server";
import { rearmPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/rearm/impl";
import {
  predecessorRearmArgsValidator,
  predecessorStatusValidator,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Rearms zero-call evidence after an intentional active-release cutover. */
export const rearm = internalMutation({
  args: predecessorRearmArgsValidator,
  returns: predecessorStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      rearmPredecessorObservation(
        ctx,
        args.previousObservationId,
        args.observationId
      )
    ),
});
