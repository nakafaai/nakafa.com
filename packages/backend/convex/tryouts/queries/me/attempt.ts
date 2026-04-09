import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { buildUserTryoutAttemptResult } from "@repo/backend/convex/tryouts/queries/me/helpers/attempt";
import { loadResolvedUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers/context";
import {
  userTryoutAttemptResultValidator,
  userTryoutLookupArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { nullable } from "convex-helpers/validators";

/**
 * Returns the authenticated user's selected tryout attempt, falling back to the
 * latest attempt when no valid selection is provided.
 */
export const getUserTryoutAttempt = query({
  args: userTryoutLookupArgs,
  returns: nullable(userTryoutAttemptResultValidator),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadResolvedUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return null;
    }

    return await buildUserTryoutAttemptResult(ctx, context);
  },
});
