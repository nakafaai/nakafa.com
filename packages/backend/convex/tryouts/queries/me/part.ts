import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { getBoundedExerciseAnswers } from "@repo/backend/convex/tryouts/helpers/loaders";
import { tryoutProductPolicies } from "@repo/backend/convex/tryouts/products";
import { loadLatestUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  userTryoutLookupArgs,
  userTryoutPartAttemptResultValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";
import { nullable } from "convex-helpers/validators";

/** Returns the authenticated user's runtime state for one tryout part. */
export const getUserTryoutPartAttempt = query({
  args: {
    ...userTryoutLookupArgs,
    partKey: tryoutPartKeyValidator,
  },
  returns: nullable(userTryoutPartAttemptResultValidator),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadLatestUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return null;
    }

    const { attempt: tryoutAttempt } = context;
    const currentPartAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
        q.eq("tryoutAttemptId", tryoutAttempt._id).eq("partKey", args.partKey)
      )
      .unique();

    if (!currentPartAttempt) {
      return {
        expiresAtMs: tryoutAttempt.expiresAt,
        partScore: null,
        partAttempt: null,
        tryoutAttempt,
      };
    }

    const setAttempt = await ctx.db.get(
      "exerciseAttempts",
      currentPartAttempt.setAttemptId
    );

    if (!setAttempt) {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part is missing its exercise attempt.",
      });
    }

    const answers = await getBoundedExerciseAnswers(ctx.db, {
      attemptId: currentPartAttempt.setAttemptId,
      totalExercises: setAttempt.totalExercises,
    });
    const isCompletedPart = tryoutAttempt.completedPartIndices.includes(
      currentPartAttempt.partIndex
    );
    const partScore = isCompletedPart
      ? {
          correctAnswers: setAttempt.correctAnswers,
          theta: currentPartAttempt.theta,
          thetaSE: currentPartAttempt.thetaSE,
          irtScore: tryoutProductPolicies[
            context.tryout.product
          ].scaleThetaToScore(currentPartAttempt.theta),
        }
      : null;

    return {
      expiresAtMs: tryoutAttempt.expiresAt,
      partScore,
      partAttempt: {
        partIndex: currentPartAttempt.partIndex,
        partKey: currentPartAttempt.partKey,
        answers,
        setAttempt,
      },
      tryoutAttempt,
    };
  },
});
