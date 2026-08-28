import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { requireSealedPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import {
  deletePredecessorRows,
  loadPredecessorRows,
  requireOwnedPredecessorRows,
} from "@repo/backend/convex/contentRelease/predecessor/rows";
import {
  decodePredecessorObservationId,
  PREDECESSOR_ROUTES,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import type { CleanupPage } from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { Effect } from "effect";

/** Proves the bound observation is sealed or has already been deleted. */
export const requireCleanupObserver = Effect.fn(
  "tryouts.migration.requireCleanupObserver"
)(function* (ctx: MutationCtx, observationId: string, deleted: boolean) {
  if (!deleted) {
    yield* requireSealedPredecessorObservation(ctx, observationId);
    return;
  }
  const rows = yield* loadPredecessorRows(ctx);
  if (PREDECESSOR_ROUTES.some((route) => rows[route] !== null)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup restored a deleted predecessor observer."
    );
  }
});

/** Deletes the exact sealed observer bound when migration writes began. */
export const cleanupObserver = Effect.fn("tryouts.migration.cleanupObserver")(
  function* (ctx: MutationCtx, rawObservationId: string) {
    yield* requireSealedPredecessorObservation(ctx, rawObservationId);
    const observationId =
      yield* decodePredecessorObservationId(rawObservationId);
    const rows = yield* requireOwnedPredecessorRows(
      yield* loadPredecessorRows(ctx),
      observationId
    );
    yield* deletePredecessorRows(ctx, rows);
    return {
      deleted: PREDECESSOR_ROUTES.length,
      kind: "observer",
    } satisfies CleanupPage;
  }
);
