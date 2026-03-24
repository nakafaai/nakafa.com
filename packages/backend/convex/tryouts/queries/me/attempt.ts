import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  loadLatestUserTryoutContext,
  loadOrderedTryoutParts,
  loadTryoutPartAttemptSummaries,
  resolveResumePartKey,
} from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  orderedTryoutPartValidator,
  tryoutPartAttemptSummaryValidator,
  userTryoutLookupArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/** Returns the authenticated user's latest tryout attempt for one tryout slug. */
export const getUserTryoutAttempt = query({
  args: userTryoutLookupArgs,
  returns: nullable(
    v.object({
      attempt: vv.doc("tryoutAttempts"),
      orderedParts: v.array(orderedTryoutPartValidator),
      partAttempts: v.array(tryoutPartAttemptSummaryValidator),
      resumePartKey: v.optional(tryoutPartKeyValidator),
      expiresAtMs: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadLatestUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return null;
    }

    const { attempt, tryout } = context;

    const [orderedParts, partAttempts] = await Promise.all([
      loadOrderedTryoutParts(ctx, {
        partCount: tryout.partCount,
        tryoutId: tryout._id,
      }),
      loadTryoutPartAttemptSummaries(ctx, {
        partCount: tryout.partCount,
        tryoutAttemptId: attempt._id,
      }),
    ]);

    if (attempt.status !== "in-progress") {
      return {
        attempt,
        orderedParts,
        partAttempts,
        expiresAtMs: attempt.expiresAt,
      };
    }

    return {
      attempt,
      orderedParts,
      partAttempts,
      resumePartKey: resolveResumePartKey({
        completedPartIndices: attempt.completedPartIndices,
        orderedParts,
        partAttempts,
      }),
      expiresAtMs: attempt.expiresAt,
    };
  },
});
