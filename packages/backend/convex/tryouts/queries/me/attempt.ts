import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { resolveResumePartKey } from "@repo/backend/convex/tryouts/helpers/resume";
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
    const orderedParts = attempt.partSetSnapshots.map((partSnapshot) => ({
      partIndex: partSnapshot.partIndex,
      partKey: partSnapshot.partKey,
    }));
    const needsFinalizedRepair =
      attempt.status !== "in-progress" &&
      (attempt.totalQuestions < tryout.totalQuestionCount ||
        attempt.completedPartIndices.length < tryout.partCount);

    if (needsFinalizedRepair) {
      const finalizedSnapshot = await buildFinalizedTryoutSnapshot(ctx.db, {
        scaleVersionId: attempt.scaleVersionId,
        tryout,
        tryoutAttempt: attempt,
      });
      const scoredAttempt = {
        ...attempt,
        irtScore: finalizedSnapshot.irtScore,
        theta: finalizedSnapshot.theta,
        thetaSE: finalizedSnapshot.thetaSE,
        totalCorrect: finalizedSnapshot.totalCorrect,
        totalQuestions: finalizedSnapshot.totalQuestions,
      };
      const partAttempts = finalizedSnapshot.partSnapshots.map(
        (partSnapshot) => ({
          partIndex: partSnapshot.partIndex,
          partKey: partSnapshot.partKey,
          score: partSnapshot.score,
          setAttempt: partSnapshot.setAttempt,
        })
      );

      return {
        attempt: scoredAttempt,
        orderedParts,
        partAttempts,
        expiresAtMs: attempt.expiresAt,
      };
    }

    const tryoutPartAttempts = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
        q.eq("tryoutAttemptId", attempt._id)
      )
      .take(tryout.partCount + 1);
    const setAttempts = await getAll(
      ctx.db,
      "exerciseAttempts",
      tryoutPartAttempts.map((partAttempt) => partAttempt.setAttemptId)
    );
    const partAttemptsByPartKey = new Map(
      tryoutPartAttempts.map((partAttempt, index) => {
        const setAttempt = setAttempts[index];

        if (!setAttempt) {
          throw new ConvexError({
            code: "INVALID_ATTEMPT_STATE",
            message: "Part attempt is missing its exercise attempt.",
          });
        }

        return [
          partAttempt.partKey,
          {
            partIndex: partAttempt.partIndex,
            partKey: partAttempt.partKey,
            score: attempt.completedPartIndices.includes(partAttempt.partIndex)
              ? {
                  correctAnswers: setAttempt.correctAnswers,
                  theta: partAttempt.theta,
                  thetaSE: partAttempt.thetaSE,
                  irtScore: getTryoutReportScore(
                    tryout.product,
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
          },
        ] as const;
      })
    );
    const partAttempts = orderedParts.map((orderedPart) => {
      return (
        partAttemptsByPartKey.get(orderedPart.partKey) ?? {
          partIndex: orderedPart.partIndex,
          partKey: orderedPart.partKey,
          score: null,
          setAttempt: null,
        }
      );
    });
    const scoredAttempt = {
      ...attempt,
      irtScore: getTryoutReportScore(tryout.product, attempt.theta),
    };

    if (attempt.status !== "in-progress") {
      return {
        attempt: scoredAttempt,
        orderedParts,
        partAttempts,
        expiresAtMs: attempt.expiresAt,
      };
    }

    return {
      attempt: scoredAttempt,
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
