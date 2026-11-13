import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { ExamResponse } from "@repo/backend/confect/assessment/response";
import { Verdict } from "@repo/backend/confect/assessment/verdict";
import { Array as Arr, Option, Schema } from "effect";

/**
 * What the navigator shows of one question: its key, whether it is answered, and whether the learner
 * flagged it for review.
 */
export const PlayerCellModel = Schema.Struct({
  answered: Schema.Boolean,
  flagged: Schema.Boolean,
  /** The key that the store and the DOM name this question by. */
  key: Schema.String,
});
export type PlayerCellModel = typeof PlayerCellModel.Type;

/**
 * How a finished paper marks one question: its grade's verdict (`Verdict`), answered when the reader may not
 * see its grade, and unanswered.
 */
export const PlayerVerdict = Schema.Union([
  Verdict,
  Schema.Literals(["answered", "unanswered"]),
]);
export type PlayerVerdict = typeof PlayerVerdict.Type;

/**
 * What a finished paper's navigator shows of one question: its key, its verdict, and whether the page shows
 * the question, which a number of a question it does not show cannot open.
 */
export const PlayerReviewCellModel = Schema.Struct({
  key: Schema.String,
  shown: Schema.Boolean,
  verdict: PlayerVerdict,
});
export type PlayerReviewCellModel = typeof PlayerReviewCellModel.Type;

/**
 * What the player knows of one question: enough to mark it in the navigator, to flag it, and to pick an option of
 * it from the keyboard. A section numbers its questions from 1 in their frozen order, so the position of a question
 * in the list is its number.
 */
export interface PlayerQuestionModel extends PlayerCellModel {
  /** Flags the question to come back to it, or takes the flag off when it has one, the way `F` does. */
  readonly flag: () => void;
  /**
   * Picks the option at `index` of this question, the way the digit keys do. It answers `true` when the question
   * took the pick, and `false` when the question has no option at that index or takes no single choice.
   */
  readonly pick: (index: number) => boolean;
}

/**
 * The option that a digit key picks: the option at `index` of a question whose one interaction is a choice
 * that takes one option. A question of another shape, a multiple choice, or an index past the options has
 * no option that a digit key picks.
 */
function pickedOption(
  interactions: readonly Interaction[],
  index: number
): Option.Option<string> {
  const [only, ...rest] = interactions;
  if (
    only?.kind !== "choice" ||
    only.maxChoices !== 1 ||
    Arr.isReadonlyArrayNonEmpty(rest)
  ) {
    return Option.none();
  }
  return Option.map(Arr.get(only.options, index), (option) => option.id);
}

/**
 * A binding's questions as the player marks, flags, and picks them, in the binding's order. The binding reads
 * how the navigator marks each question (`cell`) and the interactions a digit key picks from (`interactions`),
 * and names the save of an answer (`answer`) and of a flag (`flag`). A digit key answers with the one option it
 * picks, through the same save a press on that option uses.
 */
export function projectQuestions<Question>(input: {
  readonly answer: (question: Question, response: ExamResponse) => void;
  readonly cell: (question: Question) => PlayerCellModel;
  readonly flag: (question: Question) => void;
  readonly interactions: (question: Question) => readonly Interaction[];
  readonly questions: readonly Question[];
}): readonly PlayerQuestionModel[] {
  return Arr.map(input.questions, (question) => ({
    ...input.cell(question),
    flag: () => input.flag(question),
    pick: (index) =>
      Option.match(pickedOption(input.interactions(question), index), {
        onNone: () => false,
        onSome: (optionId) => {
          input.answer(question, [optionId]);
          return true;
        },
      }),
  }));
}
