import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { getTryoutAccessCampaignByOptionalId } from "@repo/backend/confect/modules/tryout/tryoutAccessCampaignRead.service";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/confect/modules/tryout/tryoutFinalizeSnapshot.service";
import { loadBoundedTryoutPartAttempts } from "@repo/backend/confect/modules/tryout/tryoutLoaders.service";
import type { UserTryoutContext } from "@repo/backend/confect/modules/tryout/tryoutMeContext.service";
import {
  buildTryoutPartRouteMappings,
  loadValidatedTryoutPartSets,
} from "@repo/backend/confect/modules/tryout/tryoutParts.service";
import { getTryoutReportScore } from "@repo/backend/confect/modules/tryout/tryoutReporting.service";
import { getTryoutPublicResultStatus } from "@repo/backend/confect/modules/tryout/tryoutResultStatus.service";
import { resolveResumePartKey } from "@repo/backend/confect/modules/tryout/tryoutResume.service";
import { Effect } from "effect";

/** Builds the full public attempt result for the current user. */
export const buildUserTryoutAttemptResult = Effect.fn(
  "tryouts.me.buildUserTryoutAttemptResult"
)(function* (context: UserTryoutContext) {
  const reader = yield* DatabaseReader;
  const { attempt, tryout } = context;
  const accessCampaign = yield* getTryoutAccessCampaignByOptionalId(
    attempt.accessCampaignId
  );
  const currentPartSets = yield* loadValidatedTryoutPartSets({
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
    const finalizedSnapshot = yield* buildFinalizedTryoutSnapshot({
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
      expiresAtMs: attempt.expiresAt,
      orderedParts,
      partAttempts,
    };
  }

  const tryoutPartAttempts = yield* loadBoundedTryoutPartAttempts({
    partCount: attempt.partSetSnapshots.length,
    tryoutAttemptId: attempt._id,
  });
  const setAttempts = yield* Effect.forEach(tryoutPartAttempts, (partAttempt) =>
    reader
      .table("exerciseAttempts")
      .get(partAttempt.setAttemptId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)))
  );
  const partAttemptsByPartIndex = new Map();

  for (const [index, partAttempt] of tryoutPartAttempts.entries()) {
    const setAttempt = setAttempts[index];

    if (!setAttempt) {
      return yield* Effect.fail(
        new TryoutError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Part attempt is missing its exercise attempt.",
        })
      );
    }

    partAttemptsByPartIndex.set(partAttempt.partIndex, {
      partIndex: partAttempt.partIndex,
      partKey:
        currentPartKeyBySnapshotIndex.get(partAttempt.partIndex) ??
        partAttempt.partKey,
      score: attempt.completedPartIndices.includes(partAttempt.partIndex)
        ? {
            correctAnswers: setAttempt.correctAnswers,
            irtScore: getTryoutReportScore(tryout.product, partAttempt.theta),
            theta: partAttempt.theta,
            thetaSE: partAttempt.thetaSE,
          }
        : null,
      setAttempt: {
        lastActivityAt: setAttempt.lastActivityAt,
        startedAt: setAttempt.startedAt,
        status: setAttempt.status,
        timeLimit: setAttempt.timeLimit,
      },
    });
  }

  const partAttempts = orderedParts.map(
    (orderedPart) =>
      partAttemptsByPartIndex.get(orderedPart.partIndex) ?? {
        partIndex: orderedPart.partIndex,
        partKey: orderedPart.partKey,
        score: null,
        setAttempt: null,
      }
  );
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
      return yield* Effect.fail(
        new TryoutError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Finalized tryout is missing one of its part scores.",
        })
      );
    }

    return {
      attempt: scoredAttempt,
      expiresAtMs: attempt.expiresAt,
      orderedParts,
      partAttempts,
    };
  }

  return {
    attempt: scoredAttempt,
    expiresAtMs: attempt.expiresAt,
    orderedParts,
    partAttempts,
    resumePartKey: resolveResumePartKey({
      completedPartIndices: attempt.completedPartIndices,
      orderedParts,
      partAttempts,
    }),
  };
});
