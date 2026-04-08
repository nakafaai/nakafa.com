import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { getBoundedExerciseAnswers } from "@repo/backend/convex/tryouts/helpers/loaders";
import {
  loadValidatedTryoutPartSets,
  resolveRequestedTryoutPart,
} from "@repo/backend/convex/tryouts/helpers/parts";
import { getTryoutPublicResultStatus } from "@repo/backend/convex/tryouts/helpers/publicResultStatus";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { loadResolvedUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers/context";
import {
  userTryoutLookupArgs,
  userTryoutPartAttemptResultValidator,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Returns the authenticated user's runtime state for one selected tryout part,
 * falling back to the latest attempt when no valid selection is provided.
 */
export const getUserTryoutPartAttempt = query({
  args: {
    ...userTryoutLookupArgs,
    partKey: tryoutPartKeyValidator,
  },
  returns: nullable(userTryoutPartAttemptResultValidator),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadResolvedUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return null;
    }

    const { attempt: tryoutAttempt } = context;
    const accessCampaign = tryoutAttempt.accessCampaignId
      ? await ctx.db.get(
          "tryoutAccessCampaigns",
          tryoutAttempt.accessCampaignId
        )
      : null;
    const scoredTryoutAttempt = {
      ...tryoutAttempt,
      irtScore: getTryoutReportScore(
        context.tryout.product,
        tryoutAttempt.theta
      ),
      publicResultStatus: getTryoutPublicResultStatus({
        accessCampaign,
        tryoutAttempt,
      }),
    };
    const endedAttemptHasUntouchedParts =
      tryoutAttempt.status !== "in-progress" &&
      tryoutAttempt.completedPartIndices.length <
        tryoutAttempt.partSetSnapshots.length;
    const finalizedSnapshot = endedAttemptHasUntouchedParts
      ? await buildFinalizedTryoutSnapshot(ctx.db, {
          scaleVersionId: tryoutAttempt.scaleVersionId,
          tryout: context.tryout,
          tryoutAttempt,
        })
      : null;
    const resolvedTryoutAttempt = finalizedSnapshot
      ? {
          ...scoredTryoutAttempt,
          irtScore: finalizedSnapshot.irtScore,
          theta: finalizedSnapshot.theta,
          thetaSE: finalizedSnapshot.thetaSE,
          totalCorrect: finalizedSnapshot.totalCorrect,
          totalQuestions: finalizedSnapshot.totalQuestions,
        }
      : scoredTryoutAttempt;
    const currentPartSets = await loadValidatedTryoutPartSets(ctx.db, {
      partCount: context.tryout.partCount,
      tryoutId: context.tryout._id,
    });
    const resolvedPart = resolveRequestedTryoutPart({
      currentPartSets,
      partSetSnapshots: tryoutAttempt.partSetSnapshots,
      requestedPartKey: args.partKey,
    });

    if (!resolvedPart) {
      return {
        expiresAtMs: tryoutAttempt.expiresAt,
        part: null,
        partScore: null,
        partAttempt: null,
        tryoutAttempt: resolvedTryoutAttempt,
      };
    }

    const set = await ctx.db.get("exerciseSets", resolvedPart.snapshot.setId);

    if (!set) {
      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout part is missing its exercise set.",
      });
    }

    const part = {
      currentPartKey: resolvedPart.currentPartKey,
      material: set.material,
      questionCount: resolvedPart.snapshot.questionCount,
      setSlug: set.slug,
    };

    const currentPartAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
        q
          .eq("tryoutAttemptId", tryoutAttempt._id)
          .eq("partIndex", resolvedPart.snapshot.partIndex)
      )
      .unique();

    if (!currentPartAttempt) {
      if (finalizedSnapshot) {
        const partSnapshot = finalizedSnapshot.partSnapshots.find(
          (snapshot) => snapshot.partIndex === resolvedPart.snapshot.partIndex
        );

        if (!partSnapshot) {
          return {
            expiresAtMs: tryoutAttempt.expiresAt,
            part,
            partScore: null,
            partAttempt: null,
            tryoutAttempt: resolvedTryoutAttempt,
          };
        }

        return {
          expiresAtMs: tryoutAttempt.expiresAt,
          part,
          partScore: partSnapshot.score,
          partAttempt: null,
          tryoutAttempt: resolvedTryoutAttempt,
        };
      }

      if (tryoutAttempt.status !== "in-progress") {
        throw new ConvexError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Finalized tryout is missing its part attempt.",
        });
      }

      return {
        expiresAtMs: tryoutAttempt.expiresAt,
        part,
        partScore: null,
        partAttempt: null,
        tryoutAttempt: resolvedTryoutAttempt,
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
    const resolvedPartScore = finalizedSnapshot?.partSnapshots.find(
      (snapshot) => snapshot.partIndex === resolvedPart.snapshot.partIndex
    )?.score;
    let partScore = resolvedPartScore ?? null;

    if (!partScore && isCompletedPart) {
      partScore = {
        correctAnswers: setAttempt.correctAnswers,
        theta: currentPartAttempt.theta,
        thetaSE: currentPartAttempt.thetaSE,
        irtScore: getTryoutReportScore(
          context.tryout.product,
          currentPartAttempt.theta
        ),
      };
    }

    if (!partScore && tryoutAttempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Finalized tryout part is missing its score.",
      });
    }

    return {
      expiresAtMs: tryoutAttempt.expiresAt,
      part,
      partScore,
      partAttempt: {
        partIndex: currentPartAttempt.partIndex,
        partKey: resolvedPart.currentPartKey,
        answers,
        setAttempt,
      },
      tryoutAttempt: resolvedTryoutAttempt,
    };
  },
});
