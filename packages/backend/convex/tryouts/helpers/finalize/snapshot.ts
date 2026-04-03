import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import { getScaleVersionItemsForSet } from "@repo/backend/convex/irt/scales/read";
import { scoreFinalizedTryoutPart } from "@repo/backend/convex/tryouts/helpers/finalize/score";
import {
  getBoundedExerciseAnswers,
  loadBoundedTryoutPartAttempts,
} from "@repo/backend/convex/tryouts/helpers/loaders";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import { ConvexError } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getAll } from "convex-helpers/server/relationships";

type TryoutDb = QueryCtx["db"] | MutationCtx["db"];

type ExerciseAttemptSummary = Pick<
  Doc<"exerciseAttempts">,
  "lastActivityAt" | "startedAt" | "status" | "timeLimit"
>;

export interface FinalizedTryoutPartSnapshot {
  partAttempt: Doc<"tryoutPartAttempts"> | null;
  partIndex: number;
  partKey: string;
  score: {
    correctAnswers: number;
    irtScore: number;
    theta: number;
    thetaSE: number;
  };
  setAttempt: ExerciseAttemptSummary | null;
}

/**
 * Rebuild one finalized tryout snapshot from its frozen scale.
 *
 * Missing parts are treated as unanswered timed sections, so they contribute
 * zero correct answers and all-false response vectors to the overall theta.
 */
export async function buildFinalizedTryoutSnapshot(
  db: TryoutDb,
  {
    scaleVersionId,
    tryout,
    tryoutAttempt,
  }: {
    scaleVersionId: Doc<"tryoutAttempts">["scaleVersionId"];
    tryout: Pick<
      Doc<"tryouts">,
      "_id" | "partCount" | "product" | "totalQuestionCount"
    >;
    tryoutAttempt: Pick<
      Doc<"tryoutAttempts">,
      "_id" | "completedPartIndices" | "partSetSnapshots"
    >;
  }
) {
  const completedPartIndices = new Set(tryoutAttempt.completedPartIndices);
  const partSetSnapshots = tryoutAttempt.partSetSnapshots;
  const partAttempts = await loadBoundedTryoutPartAttempts(db, {
    partCount: tryout.partCount,
    tryoutAttemptId: tryoutAttempt._id,
  });
  const setAttempts = await getAll(
    db,
    "exerciseAttempts",
    partAttempts.map((partAttempt) => partAttempt.setAttemptId)
  );
  const setAttemptsByPartIndex = new Map<number, Doc<"exerciseAttempts">>();
  const partAttemptsByPartIndex = new Map<number, Doc<"tryoutPartAttempts">>();

  for (const [index, partAttempt] of partAttempts.entries()) {
    const setAttempt = setAttempts[index];

    if (!setAttempt) {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part is missing its exercise attempt.",
      });
    }

    partAttemptsByPartIndex.set(partAttempt.partIndex, partAttempt);
    setAttemptsByPartIndex.set(partAttempt.partIndex, setAttempt);
  }

  const partSnapshots = await asyncMap(
    partSetSnapshots,
    async (partSetSnapshot) => {
      const partAttempt =
        partAttemptsByPartIndex.get(partSetSnapshot.partIndex) ?? null;
      const setAttempt =
        setAttemptsByPartIndex.get(partSetSnapshot.partIndex) ?? null;
      const effectiveSetId = partAttempt?.setId ?? partSetSnapshot.setId;

      const answers =
        partAttempt &&
        setAttempt &&
        completedPartIndices.has(partSetSnapshot.partIndex)
          ? await getBoundedExerciseAnswers(db, {
              attemptId: partAttempt.setAttemptId,
              totalExercises: setAttempt.totalExercises,
            })
          : [];
      const itemParamsRecords = await getScaleVersionItemsForSet(db, {
        questionCount:
          setAttempt?.totalExercises ?? partSetSnapshot.questionCount,
        scaleVersionId,
        setId: effectiveSetId,
      });
      const partScore = scoreFinalizedTryoutPart({
        answers,
        itemParamsRecords,
        totalQuestions:
          setAttempt?.totalExercises ?? partSetSnapshot.questionCount,
      });

      return {
        partAttempt,
        partIndex: partSetSnapshot.partIndex,
        partKey: partSetSnapshot.partKey,
        rawPartScore: partScore,
        score: {
          correctAnswers: partScore.rawScore,
          irtScore: getTryoutReportScore(tryout.product, partScore.theta),
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
      } satisfies FinalizedTryoutPartSnapshot & {
        rawPartScore: typeof partScore;
      };
    }
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
  const { theta, se } = estimateThetaEAP(allResponses);

  return {
    irtScore: getTryoutReportScore(tryout.product, theta),
    partSnapshots,
    theta,
    thetaSE: se,
    totalCorrect,
    totalQuestions,
  };
}
