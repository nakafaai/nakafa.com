import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import { readAttemptHistoryPage } from "@repo/backend/convex/tryouts/runtime/lookup";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import { loadAttemptScoreResult } from "@repo/backend/convex/tryouts/score/result";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const MAX_HISTORY_PAGE_SIZE = 25;

const historyRowValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  attemptNumber: v.number(),
  completedAt: v.union(v.number(), v.null()),
  score: v.union(tryoutScoreResultValidator, v.null()),
  startedAt: v.number(),
  status: tryoutStatusValidator,
});

/** Returns the current user's bounded newest-first score history for one set. */
export const list = query({
  args: {
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
    publicPath: v.string(),
  },
  returns: paginationResultValidator(historyRowValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const { appUser } = yield* tryRuntimePromise(() => requireAuth(ctx));
        const history = yield* readAttemptHistoryPage(ctx, args, appUser._id, {
          ...args.paginationOpts,
          numItems: Math.min(
            args.paginationOpts.numItems,
            MAX_HISTORY_PAGE_SIZE
          ),
        });
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
      })
    ),
});
