import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import {
  abandonPredecessorObservation,
  armPredecessorObservation,
  readPredecessorObservation,
  sealPredecessorObservation,
} from "@repo/backend/convex/contentRelease/predecessor/control";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import {
  predecessorAbandonReceiptValidator,
  predecessorObservationArgsValidator,
  predecessorRecordArgsValidator,
  predecessorRecordResultValidator,
  predecessorStatusValidator,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Arms every predecessor route for one exact active release. */
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

/** Records one authenticated predecessor protected-content request. */
export const recordProtected = internalMutation({
  args: predecessorRecordArgsValidator,
  returns: predecessorRecordResultValidator,
  handler: (ctx) => runConvexProgram(recordPredecessorRead(ctx, "protected")),
});

/** Records one authenticated predecessor retained-history request. */
export const recordHistory = internalMutation({
  args: predecessorRecordArgsValidator,
  returns: predecessorRecordResultValidator,
  handler: (ctx) => runConvexProgram(recordPredecessorRead(ctx, "history")),
});

/** Seals every route after the exact quiet period succeeds. */
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
