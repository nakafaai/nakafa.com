import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import { evaluate } from "@repo/backend/confect/response/evaluation";
import { select } from "@repo/backend/confect/response/selection";
import { Result } from "effect";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";

/**
 * Reports whether one authored preview selection is complete and valid. The
 * preview renders no fields for short answers and rubrics, so they never hold
 * a selection.
 */
export function isPreviewComplete(
  responseSpec: QuestionResponse,
  selection: TryoutResponseSelection | null
) {
  if (
    selection === null ||
    responseSpec.kind === "short-answer" ||
    responseSpec.kind === "rubric"
  ) {
    return false;
  }
  return Result.match(select(responseSpec, selection), {
    onFailure: () => false,
    onSuccess: ({ isComplete }) => isComplete,
  });
}

/** Reports whether one complete authored preview selection matches its key. */
export function isPreviewCorrect(
  responseSpec: QuestionResponse,
  selection: TryoutResponseSelection | null
) {
  if (
    selection === null ||
    responseSpec.kind === "short-answer" ||
    responseSpec.kind === "rubric"
  ) {
    return false;
  }
  return Result.match(evaluate(responseSpec, selection), {
    onFailure: () => false,
    onSuccess: ({ isComplete, outcome }) =>
      isComplete && outcome.status === "correct",
  });
}
