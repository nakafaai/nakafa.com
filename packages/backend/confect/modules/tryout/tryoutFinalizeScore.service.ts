import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import { estimateThetaEap } from "@repo/backend/confect/modules/tryout/irt.estimation";
import { buildOperationalIrtResponses } from "@repo/backend/confect/modules/tryout/tryoutIrt.service";
import { countCorrectAnswers } from "@repo/backend/confect/modules/tryout/tryoutMetrics.service";

/** Scores a finalized tryout part from raw answers and frozen scale items. */
export function scoreFinalizedTryoutPart(args: {
  readonly answers: readonly Doc<"exerciseAnswers">[];
  readonly itemParamsRecords: readonly Doc<"irtScaleVersionItems">[];
  readonly totalQuestions: number;
}) {
  const responses = buildOperationalIrtResponses({
    answers: args.answers,
    itemParamsRecords: args.itemParamsRecords,
  });
  const { theta, se } = estimateThetaEap(responses);

  return {
    rawScore: countCorrectAnswers(args.answers),
    responses,
    theta,
    thetaSE: se,
    totalQuestions: args.totalQuestions,
  };
}
