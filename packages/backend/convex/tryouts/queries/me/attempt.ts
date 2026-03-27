import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { loadBoundedTryoutPartAttempts } from "@repo/backend/convex/tryouts/helpers/loaders";
import { loadValidatedTryoutPartSets } from "@repo/backend/convex/tryouts/helpers/parts";
import { resolveResumePartKey } from "@repo/backend/convex/tryouts/helpers/resume";
import { tryoutProductPolicies } from "@repo/backend/convex/tryouts/products";
import { loadLatestUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  userTryoutAttemptResultValidator,
  userTryoutLookupArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

/** Returns the authenticated user's latest tryout attempt for one tryout slug. */
export const getUserTryoutAttempt = query({
  args: userTryoutLookupArgs,
  returns: nullable(userTryoutAttemptResultValidator),
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
    const [tryoutPartSets, tryoutPartAttempts] = await Promise.all([
      loadValidatedTryoutPartSets(ctx.db, {
        partCount: tryout.partCount,
        tryoutId: tryout._id,
      }),
      loadBoundedTryoutPartAttempts(ctx.db, {
        partCount: tryout.partCount,
        tryoutAttemptId: attempt._id,
      }),
    ]);
    const orderedParts = tryoutPartSets.map((tryoutPartSet) => ({
      partIndex: tryoutPartSet.partIndex,
      partKey: tryoutPartSet.partKey,
    }));
    const setAttempts = await getAll(
      ctx.db,
      "exerciseAttempts",
      tryoutPartAttempts.map((partAttempt) => partAttempt.setAttemptId)
    );
    const partAttempts = tryoutPartAttempts.map((partAttempt, index) => {
      const setAttempt = setAttempts[index];

      if (!setAttempt) {
        throw new ConvexError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Part attempt is missing its exercise attempt.",
        });
      }

      return {
        partIndex: partAttempt.partIndex,
        partKey: partAttempt.partKey,
        score: attempt.completedPartIndices.includes(partAttempt.partIndex)
          ? {
              theta: partAttempt.theta,
              thetaSE: partAttempt.thetaSE,
              irtScore: tryoutProductPolicies[tryout.product].scaleThetaToScore(
                partAttempt.theta
              ),
            }
          : null,
        setAttempt: {
          lastActivityAt: setAttempt.lastActivityAt,
          startedAt: setAttempt.startedAt,
          status: setAttempt.status,
          timeLimit: setAttempt.timeLimit,
        },
      };
    });

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
