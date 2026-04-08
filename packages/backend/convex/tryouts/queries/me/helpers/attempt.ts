import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { loadBoundedTryoutPartAttempts } from "@repo/backend/convex/tryouts/helpers/loaders";
import {
  buildTryoutPartRouteMappings,
  loadValidatedTryoutPartSets,
} from "@repo/backend/convex/tryouts/helpers/parts";
import { getTryoutPublicResultStatus } from "@repo/backend/convex/tryouts/helpers/publicResultStatus";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { resolveResumePartKey } from "@repo/backend/convex/tryouts/helpers/resume";
import type { ResolvedUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers/context";
import { ConvexError } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

/**
 * Build the public selected-attempt payload used by the set route and part
 * route.
 */
export async function buildUserTryoutAttemptResult(
  ctx: QueryCtx,
  context: ResolvedUserTryoutContext
) {
  const { attempt, tryout } = context;
  const accessCampaign = attempt.accessCampaignId
    ? await ctx.db.get("tryoutAccessCampaigns", attempt.accessCampaignId)
    : null;
  const currentPartSets = await loadValidatedTryoutPartSets(ctx.db, {
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });
  const { currentPartKeyBySnapshotIndex } = buildTryoutPartRouteMappings({
    currentPartSets,
    partSetSnapshots: attempt.partSetSnapshots,
  });
  const orderedParts = attempt.partSetSnapshots.map((partSnapshot) => ({
    partIndex: partSnapshot.partIndex,
    partKey:
      currentPartKeyBySnapshotIndex.get(partSnapshot.partIndex) ??
      partSnapshot.partKey,
  }));
  const endedAttemptHasUntouchedParts =
    attempt.status !== "in-progress" &&
    attempt.completedPartIndices.length < attempt.partSetSnapshots.length;

  if (endedAttemptHasUntouchedParts) {
    const finalizedSnapshot = await buildFinalizedTryoutSnapshot(ctx.db, {
      scaleVersionId: attempt.scaleVersionId,
      tryout,
      tryoutAttempt: attempt,
    });
    const scoredAttempt = {
      ...attempt,
      irtScore: finalizedSnapshot.irtScore,
      publicResultStatus: getTryoutPublicResultStatus({
        accessCampaign,
        tryoutAttempt: attempt,
      }),
      theta: finalizedSnapshot.theta,
      thetaSE: finalizedSnapshot.thetaSE,
      totalCorrect: finalizedSnapshot.totalCorrect,
      totalQuestions: finalizedSnapshot.totalQuestions,
    };
    const partAttempts = finalizedSnapshot.partSnapshots.map(
      (partSnapshot) => ({
        partIndex: partSnapshot.partIndex,
        partKey:
          currentPartKeyBySnapshotIndex.get(partSnapshot.partIndex) ??
          partSnapshot.partKey,
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

  const tryoutPartAttempts = await loadBoundedTryoutPartAttempts(ctx.db, {
    partCount: attempt.partSetSnapshots.length,
    tryoutAttemptId: attempt._id,
  });
  const setAttempts = await getAll(
    ctx.db,
    "exerciseAttempts",
    tryoutPartAttempts.map((partAttempt) => partAttempt.setAttemptId)
  );
  const partAttemptsByPartIndex = new Map(
    tryoutPartAttempts.map((partAttempt, index) => {
      const setAttempt = setAttempts[index];

      if (!setAttempt) {
        throw new ConvexError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Part attempt is missing its exercise attempt.",
        });
      }

      return [
        partAttempt.partIndex,
        {
          partIndex: partAttempt.partIndex,
          partKey:
            currentPartKeyBySnapshotIndex.get(partAttempt.partIndex) ??
            partAttempt.partKey,
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
      partAttemptsByPartIndex.get(orderedPart.partIndex) ?? {
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
    publicResultStatus: getTryoutPublicResultStatus({
      accessCampaign,
      tryoutAttempt: attempt,
    }),
  };

  if (attempt.status !== "in-progress") {
    const missingPart = partAttempts.find((partAttempt) => !partAttempt.score);

    if (missingPart) {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Finalized tryout is missing one of its part scores.",
      });
    }

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
}
