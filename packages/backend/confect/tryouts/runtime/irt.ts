import { estimateIrtScore } from "@repo/backend/confect/tryouts/runtime/estimate";
import type { TryoutIrtSource } from "@repo/backend/confect/tryouts/runtime/irt/items";
import {
  type AttemptScore,
  getRawPercentage,
} from "@repo/backend/confect/tryouts/runtime/result";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/** Scores a section or complete attempt from its validated calibration links. */
export const scoreIrt = Effect.fn("tryouts.runtime.scoreIrt")(function* (args: {
  placements: readonly Doc<"tryoutAttemptPlacements">[];
  responses: readonly Doc<"tryoutResponses">[];
  source: TryoutIrtSource;
  totalQuestions: number;
}) {
  const placementIds = new Set(args.placements.map(({ _id }) => _id));
  const responses = new Map(
    args.responses.map((response) => [response.placementId, response])
  );
  const answers = args.source.items
    .filter(({ placementId }) => placementIds.has(placementId))
    .map(({ item, placementId }) => ({
      item,
      isCorrect: responses.get(placementId)?.isCorrect ?? false,
    }));
  const estimate = yield* estimateIrtScore(answers);
  const correctAnswers = answers.filter(({ isCorrect }) => isCorrect).length;
  return {
    publishedScore: estimate.publishedScore,
    rawScore: getRawPercentage(correctAnswers, args.totalQuestions),
    scaleVersionId: args.source.scale._id,
    scoreStatus: args.source.scale.status,
    scoringStrategy: "irt",
    theta: estimate.theta,
    thetaSE: estimate.thetaSE,
    totalCorrect: correctAnswers,
    totalQuestions: args.totalQuestions,
  } satisfies AttemptScore;
});
