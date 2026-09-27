import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type {
  TryoutScoreResult,
  TryoutScoringStrategy,
  TryoutSectionScore,
} from "@repo/backend/confect/tryouts/score";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Stores the complete score snapshot produced before finalizing an attempt. */
export interface AttemptScore extends TryoutScoreResult {
  scaleVersionId?: Id<"irtScaleVersions">;
}

/** Produces a conventional score from one immutable correctness summary. */
export function scoreRawAnswers({
  correctAnswers,
  scoringStrategy,
  totalQuestions,
}: {
  correctAnswers: number;
  scoringStrategy: TryoutScoringStrategy;
  totalQuestions: number;
}): AttemptScore {
  const publishedScore = getRawPercentage(correctAnswers, totalQuestions);
  return {
    publishedScore,
    rawScore: publishedScore,
    scoreStatus: "official",
    scoringStrategy,
    totalCorrect: correctAnswers,
    totalQuestions,
  };
}

/** Stores the immutable section-owned subset of one calculated score. */
export const getSectionScoreSnapshot = Effect.fn(
  "tryouts.runtime.getSectionScoreSnapshot"
)(function* (score: AttemptScore) {
  const snapshot: TryoutSectionScore = {
    publishedScore: score.publishedScore,
    rawScore: score.rawScore,
    scoreStatus: score.scoreStatus,
    scoringStrategy: score.scoringStrategy,
  };
  if (score.theta === undefined && score.thetaSE === undefined) {
    return snapshot;
  }
  if (score.theta === undefined || score.thetaSE === undefined) {
    return yield* new TryoutRuntimeError({
      code: "TRYOUT_SCORE_ESTIMATE_INCOMPLETE",
      message: "Try-out score estimate is missing theta or standard error.",
    });
  }
  return {
    ...snapshot,
    theta: score.theta,
    thetaSE: score.thetaSE,
  };
});

/** Converts correctness from a validated positive question count to a percentage. */
export function getRawPercentage(
  correctAnswers: number,
  totalQuestions: number
) {
  return Math.round((correctAnswers / totalQuestions) * 100);
}
