import type { Docs } from "@repo/backend/confect/_generated/docs";
import type { Outcome } from "@repo/backend/confect/response/model";

/**
 * Reads how one stored try-out answer scores. Rows written before outcomes
 * were stored carry only `isCorrect`, which reads as correct or incorrect.
 */
export function readOutcome(
  response: Pick<Docs["tryoutResponses"], "isCorrect" | "outcome">
): Outcome {
  if (response.outcome !== undefined) {
    return response.outcome;
  }
  return response.isCorrect ? { status: "correct" } : { status: "incorrect" };
}
