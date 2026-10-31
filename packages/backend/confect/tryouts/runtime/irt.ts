import { isCorrectGrade } from "@repo/backend/confect/tryouts/response/answer";
import { estimateIrtScore } from "@repo/backend/confect/tryouts/runtime/estimate";
import type { TryoutIrtSource } from "@repo/backend/confect/tryouts/runtime/irt/items";
import {
  type AttemptScore,
  countCorrect,
  getRawPercentage,
  getScoreStatus,
  type ScoredAnswer,
} from "@repo/backend/confect/tryouts/runtime/result";
import { Array as Arr, Effect, HashMap, Option, Tuple } from "effect";

/**
 * Scores a section or complete attempt from its validated calibration links.
 * IRT observes correct, every point of the question earned, or not correct: a
 * grade that waits for a person enters the estimate as not correct and keeps
 * the score provisional until the person decides it.
 */
export const scoreIrt = Effect.fn("tryouts.runtime.scoreIrt")(function* (
  answers: readonly ScoredAnswer[],
  source: TryoutIrtSource,
  totalQuestions: number
) {
  const byPlacement = HashMap.fromIterable(
    Arr.map(answers, (answer) => Tuple.make(answer.placementId, answer))
  );
  const estimate = yield* estimateIrtScore(
    Arr.getSomes(
      Arr.map(source.items, ({ item, placementId }) =>
        Option.map(HashMap.get(byPlacement, placementId), ({ grade }) => ({
          isCorrect: isCorrectGrade(grade),
          item,
        }))
      )
    )
  );
  return {
    publishedScore: estimate.publishedScore,
    rawScore: getRawPercentage(answers),
    scaleVersionId: source.scale._id,
    scoreStatus: getScoreStatus(answers, source.scale.status),
    scoringStrategy: "irt",
    theta: estimate.theta,
    thetaSE: estimate.thetaSE,
    totalCorrect: countCorrect(answers),
    totalQuestions,
  } satisfies AttemptScore;
});
