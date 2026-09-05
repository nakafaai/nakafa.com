import type { TryoutSetIdentity } from "@repo/backend/content/tryout/set";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  decodeTryoutSetIdentity,
  tryoutSetIdentityValidator,
} from "@repo/backend/convex/tryouts/route";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import { readAttemptHistoryPageBySet } from "@repo/backend/convex/tryouts/runtime/lookup";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import { loadAttemptScoreResult } from "@repo/backend/convex/tryouts/score/result";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import {
  type PaginationOptions,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const MAX_HISTORY_ROWS_READ = 25;

const historyRowValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  attemptNumber: v.number(),
  completedAt: v.union(v.number(), v.null()),
  score: v.union(tryoutScoreResultValidator, v.null()),
  startedAt: v.number(),
  status: tryoutStatusValidator,
});

/** Loads and projects one bounded history page for the current app user. */
const readHistoryPage = Effect.fn("tryouts.queries.history.readPage")(
  function* (
    ctx: QueryCtx,
    identity: TryoutSetIdentity,
    paginationOpts: PaginationOptions
  ) {
    const { appUser } = yield* tryRuntimePromise(() => requireAuth(ctx));
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
      { concurrency: "unbounded" }
    );

    return { ...history, page };
  }
);

/** Returns bounded score history through one immutable signed set identity. */
export const bySet = query({
  args: {
    paginationOpts: paginationOptsValidator,
    ...tryoutSetIdentityValidator.fields,
  },
  returns: paginationResultValidator(historyRowValidator),
  handler: (ctx, args) => {
    const { paginationOpts, ...identity } = args;
    return runConvexProgram(
      decodeTryoutSetIdentity(identity).pipe(
        Effect.flatMap((decodedIdentity) =>
          readHistoryPage(ctx, decodedIdentity, paginationOpts)
        )
      )
    );
  },
});
