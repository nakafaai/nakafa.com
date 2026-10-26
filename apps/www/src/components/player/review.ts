import { Array as Arr } from "effect";
import type { PlayerCellModel } from "@/components/player/model";

/**
 * Splits the questions that a learner may want to see again before finishing
 * into two groups, each in the frozen order: the flagged ones, answered or
 * not, and the unanswered ones that carry no flag. A question shows once, so a
 * flagged question that is still unanswered sits with the flagged ones, where
 * its outline shows that it is unanswered.
 */
export function readReview<Question extends PlayerCellModel>(
  questions: readonly Question[]
) {
  return {
    flagged: Arr.filter(questions, (question) => question.flagged),
    unanswered: Arr.filter(
      questions,
      (question) => !(question.flagged || question.answered)
    ),
  };
}
