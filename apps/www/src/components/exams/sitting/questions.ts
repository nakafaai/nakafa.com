import {
  type ExamResponse,
  isAnswered,
} from "@repo/backend/confect/exams/sittings/response";
import { Array as Arr, Option } from "effect";
import type {
  PaperQuestion,
  PaperValue,
} from "@/components/exams/sitting/paper";
import { pickedOption } from "@/components/exams/sitting/response";
import type {
  PlayerCellModel,
  PlayerQuestionModel,
} from "@/components/player/model";

/** A question is answered once the student saved at least one option of it, or text that is not blank. */
const isQuestionAnswered = (question: PaperQuestion) =>
  question.response !== null && isAnswered(question.response);

/**
 * The paper's questions as the navigator and the finish's review mark them, in the paper's order: answered
 * and flagged follow the paper, so an answer or a flag shows as soon as the student makes it.
 */
export function projectSittingCells(
  paper: PaperValue
): readonly PlayerCellModel[] {
  return Arr.map(paper.questions, (question) => ({
    answered: isQuestionAnswered(question),
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
  readonly choose: (question: PaperQuestion, response: ExamResponse) => void;
  readonly flag: (question: PaperQuestion) => void;
  readonly paper: PaperValue;
}): readonly PlayerQuestionModel[] {
  return Arr.map(input.paper.questions, (question) => ({
    answered: isQuestionAnswered(question),
    flag: () => input.flag(question),
    flagged: question.flagged,
    key: question.id,
    pick: (index) =>
      Option.match(pickedOption(question.interactions, index), {
        onNone: () => false,
        onSome: (optionId) => {
          input.choose(question, [optionId]);
          return true;
        },
      }),
  }));
}
