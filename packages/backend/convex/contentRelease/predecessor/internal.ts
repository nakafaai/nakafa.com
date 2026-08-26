import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import {
  abandonPredecessorObservation,
  armPredecessorObservation,
  readPredecessorObservation,
  recordPredecessorRead,
  sealPredecessorObservation,
} from "@repo/backend/convex/contentRelease/predecessor/model";
import {
  predecessorAbandonReceiptValidator,
  predecessorObservationArgsValidator,
  predecessorRecordArgsValidator,
  predecessorRecordResultValidator,
  predecessorStatusValidator,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Arms both predecessor routes for one exact active release. */
export const arm = internalMutation({
  args: predecessorObservationArgsValidator,
  returns: predecessorStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(armPredecessorObservation(ctx, args.observationId)),
});

/** Returns the server-derived state of one armed observation. */
export const status = internalQuery({
  args: predecessorObservationArgsValidator,
  returns: predecessorStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(readPredecessorObservation(ctx, args.observationId)),
});

/** Records one authenticated predecessor singular request. */
export const recordSingular = internalMutation({
  args: predecessorRecordArgsValidator,
  returns: predecessorRecordResultValidator,
  handler: (ctx) => runConvexProgram(recordPredecessorRead(ctx, "singular")),
});

/** Records one authenticated predecessor batch request. */
export const recordBatch = internalMutation({
  args: predecessorRecordArgsValidator,
  returns: predecessorRecordResultValidator,
  handler: (ctx) => runConvexProgram(recordPredecessorRead(ctx, "batch")),
});

/** Seals both routes after the exact quiet period succeeds. */
export const seal = internalMutation({
  args: predecessorObservationArgsValidator,
  returns: predecessorStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(sealPredecessorObservation(ctx, args.observationId)),
});

/** Deletes one exact observation only after its active release has drifted. */
export const abandon = internalMutation({
  args: predecessorObservationArgsValidator,
  returns: predecessorAbandonReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(abandonPredecessorObservation(ctx, args.observationId)),
});
