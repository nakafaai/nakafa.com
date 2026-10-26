import { Array as Arr, Option } from "effect";
import type {
  PaperQuestion,
  PaperValue,
} from "@/components/exams/sitting/paper";
import { choiceOf } from "@/components/exams/sitting/response";
import type {
  PlayerCellModel,
  PlayerQuestionModel,
} from "@/components/player/model";

/**
 * The option that a digit key picks: the option at `index` of a single choice. A question of
 * another shape, or a multiple choice, has no option that a digit key picks.
 */
const pickedOption = (question: PaperQuestion, index: number) =>
  Option.flatMap(choiceOf(question.interactions), (choice) =>
    choice.maxChoices === 1
      ? Option.map(Arr.get(choice.options, index), (option) => option.id)
      : Option.none()
  );

/** A question is answered once the student saved at least one option of it. */
const isAnswered = (question: PaperQuestion) =>
  question.response !== null && question.response.length > 0;

/**
 * The paper's questions as the navigator and the finish's review mark them, in the paper's order: answered
 * and flagged follow the paper, so an answer or a flag shows as soon as the student makes it.
 */
export function projectSittingCells(
  paper: PaperValue
): readonly PlayerCellModel[] {
  return Arr.map(paper.questions, (question) => ({
    answered: isAnswered(question),
    flagged: question.flagged,
    key: question.id,
  }));
}

/**
 * The paper's questions as the shared player marks, flags, and picks them. A pick saves the option at
 * once, through `choose`, as a click on the option does, a flag goes through `flag`, and a question is
 * answered once it holds a response.
 */
export function projectSittingQuestions(input: {
  readonly choose: (
    question: PaperQuestion,
    response: readonly string[]
  ) => void;
  readonly flag: (question: PaperQuestion) => void;
  readonly paper: PaperValue;
}): readonly PlayerQuestionModel[] {
  return Arr.map(input.paper.questions, (question) => ({
    answered: isAnswered(question),
    flag: () => input.flag(question),
    flagged: question.flagged,
    key: question.id,
    pick: (index) =>
      Option.match(pickedOption(question, index), {
        onNone: () => false,
        onSome: (optionId) => {
          input.choose(question, [optionId]);
          return true;
        },
      }),
  }));
}
