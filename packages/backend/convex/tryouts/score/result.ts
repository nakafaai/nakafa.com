import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import type {
  TryoutScoreResult,
  TryoutSectionScore,
} from "@repo/backend/convex/tryouts/score";
import { Effect, Schema } from "effect";
/** Expected integrity failure while reading a stored try-out score. */
export class TryoutScoreReadError
  extends Schema.TaggedError<TryoutScoreReadError>()("TryoutScoreReadError", {
    code: Schema.Literals([
      "TRYOUT_SCORE_NOT_FOUND",
      "TRYOUT_SECTION_SCORE_NOT_FOUND",
      "TRYOUT_SCORE_ESTIMATE_INCOMPLETE",
    ]),
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code:
    | "TRYOUT_SCORE_NOT_FOUND"
    | "TRYOUT_SECTION_SCORE_NOT_FOUND"
    | "TRYOUT_SCORE_ESTIMATE_INCOMPLETE";
  declare readonly message: string;
}
/** Loads the immutable attempt score exposed after terminal completion. */
export const loadAttemptScoreResult = Effect.fn("tryouts.score.loadAttempt")(
  function* (ctx: QueryCtx, attempt: Doc<"tryoutAttempts">) {
    if (attempt.status === "in-progress") {
      return null;
    }
    const score = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .unique()
    );
    if (!score) {
      return yield* new TryoutScoreReadError({
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
  function* (section: Doc<"tryoutSectionAttempts">) {
    if (section.status === "in-progress") {
      return null;
    }
    if (!section.score) {
      return yield* new TryoutScoreReadError({
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
    return yield* new TryoutScoreReadError({
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
