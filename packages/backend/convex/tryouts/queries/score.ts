import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type {
  TryoutScoreResult,
  TryoutSectionScore,
} from "@repo/backend/convex/tryouts/schema";
import { ConvexError } from "convex/values";

/** Loads the immutable attempt score exposed after terminal completion. */
export async function loadAttemptScoreResult(
  ctx: QueryCtx,
  attempt: Doc<"tryoutAttempts">
) {
  if (attempt.status === "in-progress") {
    return null;
  }

  const score = await ctx.db
    .query("tryoutScores")
    .withIndex("by_tryoutAttemptId", (q) =>
      q.eq("tryoutAttemptId", attempt._id)
    )
    .unique();

  if (!score) {
    throw new ConvexError({
      code: "TRYOUT_SCORE_NOT_FOUND",
      message: "Terminal try-out attempt is missing its score snapshot.",
    });
  }

  return getScoreResult(score, {
    totalCorrect: score.totalCorrect,
    totalQuestions: score.totalQuestions,
  });
}

/** Reads the immutable section score exposed after section completion. */
export function getSectionScoreResult(section: Doc<"tryoutSectionAttempts">) {
  if (section.status === "in-progress") {
    return null;
  }

  if (!section.score) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_SCORE_NOT_FOUND",
      message: "Terminal try-out section is missing its score snapshot.",
    });
  }

  return getScoreResult(section.score, {
    totalCorrect: section.correctAnswers,
    totalQuestions: section.totalQuestions,
  });
}

/** Projects stored score values into the shared authenticated query result. */
function getScoreResult(
  score: TryoutSectionScore,
  counts: Pick<TryoutScoreResult, "totalCorrect" | "totalQuestions">
): TryoutScoreResult {
  const result: TryoutScoreResult = {
    ...counts,
    publishedScore: score.publishedScore,
    rawScore: score.rawScore,
    scoreStatus: score.scoreStatus,
    scoringStrategy: score.scoringStrategy,
  };

  if (score.theta === undefined && score.thetaSE === undefined) {
    return result;
  }

  if (score.theta === undefined || score.thetaSE === undefined) {
    throw new ConvexError({
      code: "TRYOUT_SCORE_ESTIMATE_INCOMPLETE",
      message: "Try-out score estimate is missing theta or standard error.",
    });
  }

  return {
    ...result,
    theta: score.theta,
    thetaSE: score.thetaSE,
  };
}
