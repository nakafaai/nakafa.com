import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { Effect } from "effect";

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
