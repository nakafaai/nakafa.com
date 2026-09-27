import { requireAuth } from "@repo/backend/confect/auth/session";
import { readAttemptHistoryPageBySet } from "@repo/backend/confect/tryouts/runtime/lookup";
import { loadAttemptScoreResult } from "@repo/backend/confect/tryouts/score/result";
import type { TryoutSetIdentity } from "@repo/backend/content/tryout/set";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { PaginationOptions } from "convex/server";
import { Effect } from "effect";
export const MAX_HISTORY_ROWS_READ = 25;
/** Loads and projects one bounded history page for the current app user. */
export const readHistoryPage = Effect.fn("tryouts.queries.history.readPage")(
  function* (
    ctx: QueryCtx,
    identity: TryoutSetIdentity,
    paginationOpts: PaginationOptions
  ) {
    const { appUser } = yield* requireAuth(ctx);
    const pagination = {
      ...paginationOpts,
      maximumRowsRead: Math.min(
        paginationOpts.maximumRowsRead ?? MAX_HISTORY_ROWS_READ,
        MAX_HISTORY_ROWS_READ
      ),
      numItems: Math.min(paginationOpts.numItems, MAX_HISTORY_ROWS_READ),
    };
    const history = yield* readAttemptHistoryPageBySet(
      ctx,
      identity,
      appUser._id,
      pagination
    );
    const page = yield* Effect.forEach(
      history.page,
      (attempt) =>
        loadAttemptScoreResult(ctx, attempt).pipe(
          Effect.map((score) => ({
            attemptId: attempt._id,
            attemptNumber: attempt.attemptNumber,
            completedAt: attempt.completedAt,
            score,
            startedAt: attempt.startedAt,
            status: attempt.status,
          }))
        ),
      {
        concurrency: "unbounded",
      }
    );
    return {
      ...history,
      page,
    };
  }
);
