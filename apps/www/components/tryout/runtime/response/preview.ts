import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import {
  evaluateTryoutResponseSelection,
  validateTryoutResponseSelection,
} from "@repo/backend/convex/tryouts/response/selection";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";

/** Reports whether one authored preview selection is complete and valid. */
export function isPreviewComplete(
  responseSpec: QuestionResponse,
  selection: TryoutResponseSelection | null
) {
  if (!selection) {
    return false;
  }
  const validated = validateTryoutResponseSelection(responseSpec, selection);
  return validated.valid && validated.isComplete;
}

/** Reports whether one complete authored preview selection matches its key. */
export function isPreviewCorrect(
  responseSpec: QuestionResponse,
  selection: TryoutResponseSelection | null
) {
  if (!selection) {
    return false;
  }
  const evaluated = evaluateTryoutResponseSelection(responseSpec, selection);
  return evaluated.valid && evaluated.isComplete && evaluated.isCorrect;
}
