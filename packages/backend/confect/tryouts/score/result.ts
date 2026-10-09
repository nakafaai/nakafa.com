import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type {
  TryoutScoreResult,
  TryoutSectionScore,
} from "@repo/backend/confect/tryouts/score";
import { TryoutScoreReadError } from "@repo/backend/confect/tryouts/score";
import { Effect } from "effect";
/** Expected integrity failure while reading a stored try-out score. */

/** Loads the immutable attempt score exposed after terminal completion. */
export const loadAttemptScoreResult = Effect.fn("tryouts.score.loadAttempt")(
  function* (attempt: Docs["tryoutAttempts"]) {
    const database = yield* DatabaseReader;
    if (attempt.status === "in-progress") {
      return null;
    }
    const score = yield* database
      .table("tryoutScores")
      .get("by_tryoutAttemptId", attempt._id)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!score) {
      return yield* TryoutScoreReadError.make({
        code: "TRYOUT_SCORE_NOT_FOUND",
        message: "Terminal try-out attempt is missing its score snapshot.",
      });
    }
    return yield* getScoreResult(score, {
      totalCorrect: score.totalCorrect,
      totalQuestions: score.totalQuestions,
    });
  }
);
/** Reads the immutable section score exposed after section completion. */
export const getSectionScoreResult = Effect.fn("tryouts.score.readSection")(
  function* (section: Docs["tryoutSectionAttempts"]) {
    if (section.status === "in-progress") {
      return null;
    }
    if (!section.score) {
      return yield* TryoutScoreReadError.make({
        code: "TRYOUT_SECTION_SCORE_NOT_FOUND",
        message: "Terminal try-out section is missing its score snapshot.",
      });
    }
    return yield* getScoreResult(section.score, {
      totalCorrect: section.correctAnswers,
      totalQuestions: section.totalQuestions,
    });
  }
);
/** Projects stored score values into the shared authenticated query result. */
const getScoreResult = Effect.fn("tryouts.score.getResult")(function* (
  score: TryoutSectionScore,
  counts: Pick<TryoutScoreResult, "totalCorrect" | "totalQuestions">
) {
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
    return yield* TryoutRuntimeError.make({
      code: "TRYOUT_SCORE_ESTIMATE_INCOMPLETE",
      message: "Try-out score estimate is missing theta or standard error.",
    });
  }
  return {
    ...result,
    theta: score.theta,
    thetaSE: score.thetaSE,
  };
});
