import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexQueryCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { estimateThetaEap } from "@repo/backend/confect/modules/tryout/irt.estimation";
import { getScaleVersionItemsForSet } from "@repo/backend/confect/modules/tryout/irtScaleRead.service";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { scoreFinalizedTryoutPart } from "@repo/backend/confect/modules/tryout/tryoutFinalizeScore.service";
import {
  getBoundedExerciseAnswers,
  loadBoundedTryoutPartAttempts,
} from "@repo/backend/confect/modules/tryout/tryoutLoaders.service";
import { getTryoutReportScore } from "@repo/backend/confect/modules/tryout/tryoutReporting.service";
import { getAll } from "convex-helpers/server/relationships";
import { Effect } from "effect";

/** Builds the final scoring snapshot for a tryout attempt. */
export const buildFinalizedTryoutSnapshot = Effect.fn(
  "tryouts.finalize.buildFinalizedTryoutSnapshot"
)(function* (
  db: ConvexQueryCtx["db"],
  args: {
    readonly scaleVersionId: Id<"irtScaleVersions">;
    readonly tryout: Doc<"tryouts">;
    readonly tryoutAttempt: Doc<"tryoutAttempts">;
  }
) {
  const completedPartIndices = new Set(args.tryoutAttempt.completedPartIndices);
  const partSetSnapshots = args.tryoutAttempt.partSetSnapshots;
  const partAttempts = yield* loadBoundedTryoutPartAttempts(db, {
    partCount: partSetSnapshots.length,
    tryoutAttemptId: args.tryoutAttempt._id,
  });
  const setAttempts = yield* Effect.promise(() =>
    getAll(
      db,
      "exerciseAttempts",
      partAttempts.map((partAttempt) => partAttempt.setAttemptId)
    )
  );
  const setAttemptsByPartIndex = new Map<number, Doc<"exerciseAttempts">>();
  const partAttemptsByPartIndex = new Map<number, Doc<"tryoutPartAttempts">>();

  for (const [index, partAttempt] of partAttempts.entries()) {
    const setAttempt = setAttempts[index];

    if (!setAttempt) {
      return yield* Effect.fail(
        new TryoutError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Tryout part is missing its exercise attempt.",
        })
      );
    }

    partAttemptsByPartIndex.set(partAttempt.partIndex, partAttempt);
    setAttemptsByPartIndex.set(partAttempt.partIndex, setAttempt);
  }

  const partSnapshots = yield* Effect.forEach(
    partSetSnapshots,
    (partSetSnapshot) =>
      Effect.gen(function* () {
        const partAttempt =
          partAttemptsByPartIndex.get(partSetSnapshot.partIndex) ?? null;
        const setAttempt =
          setAttemptsByPartIndex.get(partSetSnapshot.partIndex) ?? null;
        const isCompletedPart = completedPartIndices.has(
          partSetSnapshot.partIndex
        );

        if (isCompletedPart && !partAttempt) {
          return yield* Effect.fail(
            new TryoutError({
              code: "INVALID_ATTEMPT_STATE",
              message: "Completed tryout part is missing its part attempt.",
            })
          );
        }

        const effectiveSetId = partAttempt?.setId ?? partSetSnapshot.setId;
        const answers =
          partAttempt && setAttempt
            ? yield* getBoundedExerciseAnswers(db, {
                attemptId: partAttempt.setAttemptId,
                totalExercises: setAttempt.totalExercises,
              })
            : [];
        const itemParamsRecords = yield* getScaleVersionItemsForSet(db, {
          questionCount:
            setAttempt?.totalExercises ?? partSetSnapshot.questionCount,
          scaleVersionId: args.scaleVersionId,
          setId: effectiveSetId,
        });
        const totalQuestions =
          setAttempt?.totalExercises ?? partSetSnapshot.questionCount;
        const partScore = scoreFinalizedTryoutPart({
          answers,
          itemParamsRecords,
          totalQuestions,
        });

        return {
          partAttempt,
          partIndex: partSetSnapshot.partIndex,
          partKey: partSetSnapshot.partKey,
          rawPartScore: partScore,
          score: {
            correctAnswers: partScore.rawScore,
            irtScore: getTryoutReportScore(
              args.tryout.product,
              partScore.theta
            ),
            theta: partScore.theta,
            thetaSE: partScore.thetaSE,
          },
          setAttempt: setAttempt
            ? {
                lastActivityAt: setAttempt.lastActivityAt,
                startedAt: setAttempt.startedAt,
                status: setAttempt.status,
                timeLimit: setAttempt.timeLimit,
              }
            : null,
        };
      })
  );

  const allResponses = partSnapshots.flatMap(
    (partSnapshot) => partSnapshot.rawPartScore.responses
  );
  const totalCorrect = partSnapshots.reduce(
    (count, partSnapshot) => count + partSnapshot.score.correctAnswers,
    0
  );
  const totalQuestions = partSnapshots.reduce(
    (count, partSnapshot) => count + partSnapshot.rawPartScore.totalQuestions,
    0
  );
  const { theta, se } = estimateThetaEap(allResponses);

  return {
    irtScore: getTryoutReportScore(args.tryout.product, theta),
    partSnapshots,
    theta,
    thetaSE: se,
    totalCorrect,
    totalQuestions,
  };
});
