import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { loadAttemptScoreResult } from "@repo/backend/convex/tryouts/queries/score";
import { readAttemptHistoryPage } from "@repo/backend/convex/tryouts/runtime/lookup";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";

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
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const history = await runConvexProgram(
      readAttemptHistoryPage(ctx, args, appUser._id, {
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, MAX_HISTORY_PAGE_SIZE),
      })
    );

    return {
      ...history,
      page: await Promise.all(
        history.page.map(async (attempt) => ({
          attemptId: attempt._id,
          attemptNumber: attempt.attemptNumber,
          completedAt: attempt.completedAt,
          score: await loadAttemptScoreResult(ctx, attempt),
          startedAt: attempt.startedAt,
          status: attempt.status,
        }))
      ),
    };
  },
});
