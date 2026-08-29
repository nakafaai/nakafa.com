import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  abandonPredecessorObservation,
  armPredecessorObservation,
} from "@repo/backend/convex/contentRelease/predecessor/control";
import {
  loadPredecessorRows,
  requireOwnedPredecessorRows,
} from "@repo/backend/convex/contentRelease/predecessor/rows";
import {
  decodePredecessorObservationId,
  PREDECESSOR_ROUTES,
  predecessorStatusValidator,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const rearmArgsValidator = v.object({
  observationId: v.string(),
  previousObservationId: v.string(),
});

/** Atomically replaces one unused drifted observer with the live release. */
export const rearmPredecessorObservation = Effect.fn(
  "contentRelease.predecessor.rearm"
)(function* (
  ctx: MutationCtx,
  previousObservationInput: string,
  observationInput: string
) {
  const previousObservationId = yield* decodePredecessorObservationId(
    previousObservationInput
  );
  const observationId = yield* decodePredecessorObservationId(observationInput);
  if (previousObservationId === observationId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Replacement predecessor observation requires a new identity."
    );
  }
  const rows = yield* requireOwnedPredecessorRows(
    yield* loadPredecessorRows(ctx),
    previousObservationId
  );
  if (
    PREDECESSOR_ROUTES.some((route) => {
      const row = rows[route];
      return (
        row.invocationCount !== 0 ||
        row.lastInvokedAt !== undefined ||
        row.quietSince !== row.armedAt
      );
    })
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "An invoked predecessor observation cannot be replaced."
    );
  }
  yield* abandonPredecessorObservation(ctx, previousObservationId);
  return yield* armPredecessorObservation(ctx, observationId);
});

/** Rearms zero-call evidence after an intentional active-release cutover. */
export const rearm = internalMutation({
  args: rearmArgsValidator,
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
