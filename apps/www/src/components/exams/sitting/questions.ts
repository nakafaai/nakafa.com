import { Array as Arr, Option } from "effect";
import type {
  PaperQuestion,
  PaperValue,
} from "@/components/exams/sitting/paper";
import { choiceOf } from "@/components/exams/sitting/response";
import type { PlayerQuestionModel } from "@/components/player/model";

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

/**
 * The paper's questions as the shared player marks and picks them. A pick saves the option at once,
 * through `choose`, as a click on the option does, and a question is answered once it holds a response.
 */
export function projectSittingQuestions(input: {
  readonly choose: (
    question: PaperQuestion,
    response: readonly string[]
  ) => void;
  readonly paper: PaperValue;
}): readonly PlayerQuestionModel[] {
  return Arr.map(input.paper.questions, (question) => ({
    answered: question.response !== null && question.response.length > 0,
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
