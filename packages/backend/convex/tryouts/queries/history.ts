import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { loadAttemptScoreResult } from "@repo/backend/convex/tryouts/queries/score";
import { getActiveTryoutSetByPublicPath } from "@repo/backend/convex/tryouts/read";
import {
  tryoutScoreResultValidator,
  tryoutStatusValidator,
} from "@repo/backend/convex/tryouts/schema";
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
    const set = await getActiveTryoutSetByPublicPath(ctx, args);

    if (!set) {
      return {
        continueCursor: "",
        isDone: true,
        page: [],
      };
    }

    const history = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutSetId_and_startedAt", (q) =>
        q.eq("userId", appUser._id).eq("tryoutSetId", set._id)
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, MAX_HISTORY_PAGE_SIZE),
      });

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
