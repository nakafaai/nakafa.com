import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  hasActivePredecessorIdentity,
  loadActivePredecessorIdentity,
  loadPredecessorDeployment,
  requirePredecessorDeployment,
  storedPredecessorIdentity,
} from "@repo/backend/convex/contentRelease/predecessor/identity";
import {
  expandPredecessorRows,
  loadPredecessorRows,
} from "@repo/backend/convex/contentRelease/predecessor/rows";
import {
  PREDECESSOR_ROUTES,
  type PredecessorRecordResult,
  type PredecessorRoute,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { Clock, Effect } from "effect";

/**
 * Records one authenticated predecessor call before content dispatch.
 *
 * Every row is read deliberately. Convex OCC therefore serializes unexpected
 * cross-route traffic, preserving the fail-closed observation invariant. This
 * temporary observer expects zero traffic, so correctness owns the tradeoff.
 * A late read reopens every sealed row atomically and restarts that route's
 * quiet clock. Release drift returns both identities without writing, which
 * keeps the predecessor route available while abandon owns invalidation.
 */
export const recordPredecessorRead = Effect.fn(
  "contentRelease.predecessor.record"
)(function* (ctx: MutationCtx, route: PredecessorRoute) {
  const stored = yield* loadPredecessorRows(ctx);
  if (PREDECESSOR_ROUTES.every((candidate) => stored[candidate] === null)) {
    return { kind: "inactive" } satisfies PredecessorRecordResult;
  }
  const rows = yield* expandPredecessorRows(ctx, stored);
  yield* requirePredecessorDeployment(
    rows,
    yield* loadPredecessorDeployment(ctx)
  );
  const active = yield* loadActivePredecessorIdentity(ctx);
  if (!hasActivePredecessorIdentity(rows, active)) {
    return {
      kind: "drifted",
      live: active,
      stored: storedPredecessorIdentity(rows),
    } satisfies PredecessorRecordResult;
  }
  const row = rows[route];
  if (row.invocationCount >= Number.MAX_SAFE_INTEGER) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Predecessor ${route} invocation count exceeded its safe bound.`
    );
  }
  const now = yield* Clock.currentTimeMillis;
  if (rows.singular.phase === "sealed") {
    yield* Effect.promise(() =>
      ctx.db.patch("contentPredecessorReads", row._id, {
        invocationCount: row.invocationCount + 1,
        lastInvokedAt: now,
        phase: "armed",
        quietSince: now,
        sealedAt: undefined,
      })
    );
    yield* Effect.forEach(
      PREDECESSOR_ROUTES.filter((candidate) => candidate !== route),
      (candidate) =>
        Effect.promise(() =>
          ctx.db.patch("contentPredecessorReads", rows[candidate]._id, {
            phase: "armed",
            sealedAt: undefined,
          })
        )
    );
    return { kind: "recorded" } satisfies PredecessorRecordResult;
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentPredecessorReads", row._id, {
      invocationCount: row.invocationCount + 1,
      lastInvokedAt: now,
      quietSince: now,
    })
  );
  return { kind: "recorded" } satisfies PredecessorRecordResult;
});
