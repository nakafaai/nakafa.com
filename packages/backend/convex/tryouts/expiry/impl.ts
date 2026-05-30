import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import {
  TryoutExpirySweepIoError,
  tryoutExpirySweepBatchSize,
  tryoutExpirySweepIoFailedCode,
} from "@repo/backend/convex/tryouts/expiry/spec";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

export interface TryoutExpirySweepTargets {
  expireTryoutAttempt: FunctionReference<
    "mutation",
    "internal",
    {
      expiresAtMs: number;
      tryoutAttemptId: Id<"tryoutAttempts">;
    },
    null
  >;
}

/** Maps thrown Convex IO failures into the expiry sweep error channel. */
function toTryoutExpirySweepIoError(error: unknown) {
  return new TryoutExpirySweepIoError({
    code: tryoutExpirySweepIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Loads a bounded page of overdue in-progress tryout attempts. */
const loadOverdueTryoutAttempts = Effect.fn(
  "tryouts.expiry.loadOverdueTryoutAttempts"
)(function* (ctx: MutationCtx, now: number) {
  return yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_status_and_expiresAt", (q) =>
          q.eq("status", "in-progress").lt("expiresAt", now + 1)
        )
        .take(tryoutExpirySweepBatchSize),
    catch: toTryoutExpirySweepIoError,
  });
});

/**
 * Schedules overdue tryout attempts for isolated per-attempt expiry mutations.
 *
 * The sweep intentionally avoids finalizing attempts itself. Finalization can
 * touch attempt, part, score, and leaderboard rows, so one scheduled mutation
 * per attempt keeps OCC conflict scope small.
 * @see https://docs.convex.dev/database/advanced/occ
 * @see https://docs.convex.dev/scheduling/scheduled-functions
 * @see https://effect.website/docs/error-management/expected-errors/
 */
export const scheduleExpiredTryoutAttempts = Effect.fn(
  "tryouts.expiry.scheduleExpiredTryoutAttempts"
)(function* (ctx: MutationCtx, targets: TryoutExpirySweepTargets) {
  const now = yield* Clock.currentTimeMillis;
  const overdueAttempts = yield* loadOverdueTryoutAttempts(ctx, now);

  for (const tryoutAttempt of overdueAttempts) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAfter(0, targets.expireTryoutAttempt, {
          expiresAtMs: tryoutAttempt.expiresAt,
          tryoutAttemptId: tryoutAttempt._id,
        }),
      catch: toTryoutExpirySweepIoError,
    });
  }
});
