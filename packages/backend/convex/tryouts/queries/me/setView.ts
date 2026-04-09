import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { buildUserTryoutAttemptResult } from "@repo/backend/convex/tryouts/queries/me/helpers/attempt";
import { loadResolvedUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers/context";
import { loadUserTryoutAttemptHistoryPage } from "@repo/backend/convex/tryouts/queries/me/helpers/history";
import {
  userTryoutLookupArgs,
  userTryoutSetViewResultValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { nullable } from "convex-helpers/validators";

const INITIAL_TRYOUT_HISTORY_PAGE_SIZE = 25;

/**
 * Returns the selected tryout attempt and the first picker-ready history page
 * from one cohesive server-owned route query.
 */
export const getUserTryoutSetView = query({
  args: userTryoutLookupArgs,
  returns: nullable(userTryoutSetViewResultValidator),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadResolvedUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return null;
    }

    const [attemptData, initialHistory] = await Promise.all([
      buildUserTryoutAttemptResult(ctx, context),
      loadUserTryoutAttemptHistoryPage(ctx, {
        paginationOpts: {
          cursor: null,
          numItems: INITIAL_TRYOUT_HISTORY_PAGE_SIZE,
        },
        selectedAttempt: context.attempt,
        tryout: context.tryout,
        userId: appUser._id,
      }),
    ]);

    return {
      attemptData,
      initialHistory,
    };
  },
});
