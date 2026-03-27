import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import {
  buildOperationalIrtResponses,
  type OperationalIrtResponseSource,
} from "@repo/backend/convex/tryouts/helpers/irt";
import { countCorrectAnswers } from "@repo/backend/convex/tryouts/helpers/metrics";

interface FinalizedTryoutPartScoreArgs extends OperationalIrtResponseSource {
  totalQuestions: number;
}

/**
 * Score one finalized tryout part from its persisted answers and frozen item
 * parameters.
 *
 * The caller must pass the full frozen item list for the part. Missing answers
 * stay in the operational response vector and are therefore treated as
 * incorrect, matching Nakafa's timed-tryout scoring policy.
 */
export function scoreFinalizedTryoutPart({
  answers,
  itemParamsRecords,
  totalQuestions,
}: FinalizedTryoutPartScoreArgs) {
  const responses = buildOperationalIrtResponses({
    answers,
    itemParamsRecords,
  });
  const { theta, se } = estimateThetaEAP(responses);

  return {
    rawScore: countCorrectAnswers(answers),
    responses,
    theta,
    thetaSE: se,
    totalQuestions,
  };
}
