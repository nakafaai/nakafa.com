import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  TryoutScoreResult,
  TryoutScoringStrategy,
  TryoutSectionScore,
} from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";

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
export function getSectionScoreSnapshot(
  score: AttemptScore
): TryoutSectionScore {
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
    throw new ConvexError({
      code: "TRYOUT_SCORE_ESTIMATE_INCOMPLETE",
      message: "Try-out score estimate is missing theta or standard error.",
    });
  }

  return {
    ...snapshot,
    theta: score.theta,
    thetaSE: score.thetaSE,
  };
}

/** Converts raw correctness into a bounded public percentage score. */
export function getRawPercentage(
  correctAnswers: number,
  totalQuestions: number
) {
  if (totalQuestions === 0) {
    return 0;
  }

  return Math.round((correctAnswers / totalQuestions) * 100);
}
