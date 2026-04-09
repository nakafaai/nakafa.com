import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { loadResolvedUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers/context";
import { loadUserTryoutAttemptHistoryPage } from "@repo/backend/convex/tryouts/queries/me/helpers/history";
import {
  userTryoutAttemptHistoryResultValidator,
  userTryoutHistoryArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";

/**
 * Returns one selection-aware history page for the tryout history picker.
 *
 * The initial page always starts with the resolved active attempt, while the
 * true latest attempt is flagged explicitly with `isLatest`.
 */
export const getUserTryoutAttemptHistory = query({
  args: userTryoutHistoryArgs,
  returns: userTryoutAttemptHistoryResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadResolvedUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return {
        continueCursor: "",
        isDone: true,
        page: [],
      };
    }

    return await loadUserTryoutAttemptHistoryPage(ctx, {
      paginationOpts: args.paginationOpts,
      selectedAttempt: context.attempt,
      tryout: context.tryout,
      userId: appUser._id,
    });
  },
});
