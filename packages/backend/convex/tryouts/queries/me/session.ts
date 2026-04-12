import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { loadResolvedUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers/context";
import {
  userTryoutLookupArgs,
  userTryoutSessionResultValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { nullable } from "convex-helpers/validators";

/**
 * Returns the selected tryout attempt shell state used to lock the shared
 * session sidebar while one tryout is actively in progress.
 */
export const getUserTryoutSession = query({
  args: userTryoutLookupArgs,
  returns: nullable(userTryoutSessionResultValidator),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadResolvedUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return null;
    }

    return {
      attemptId: context.attempt._id,
      expiresAtMs: context.attempt.expiresAt,
      status: context.attempt.status,
    };
  },
});
