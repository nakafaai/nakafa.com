import { Id } from "@repo/backend/confect/_generated/id";
import { QuestionView } from "@repo/backend/confect/exams/question";
import { Array as Arr, Option, Schema } from "effect";
import { createStore } from "zustand";
import type {
  Question,
  QuestionId,
} from "@/components/tenant/exams/optimistic";

/** The data of one editor's selection: the question the teacher chose, or none before a choice. */
const SelectionState = Schema.Struct({
  selected: Schema.NullOr(Id("examQuestions")),
});

/** The action that chooses a question. */
interface SelectionActions {
  /** Makes a question the one that the canvas shows. */
  readonly select: (id: QuestionId) => void;
}

/** The state of one editor's selection, with its action, as its store holds it. */
export type ExamSelection = typeof SelectionState.Type & SelectionActions;

/** The question the canvas shows, with its place among the questions. */
const ActiveQuestion = Schema.Struct({
  index: Schema.Natural,
  question: QuestionView,
});

/**
 * The question the canvas shows: the chosen question, or the first question while no
 * question is chosen or the chosen one is gone. It reads the index with the question,
 * so the strip can number it.
 */
export const activeQuestion = (
  questions: readonly Question[],
  selected: QuestionId | null
): Option.Option<typeof ActiveQuestion.Type> => {
  const found = Option.flatMap(Option.fromNullishOr(selected), (id) =>
    Arr.findFirstIndex(questions, (question) => question.id === id)
  );
  const index = Option.getOrElse(found, () => 0);
  return Option.map(Arr.get(questions, index), (question) => ({
    index,
    question,
  }));
};

/**
 * Creates the selection of one editor: the question the teacher chose, which is none
 * before a choice, and the action that chooses one. Each provider creates its own, once.
 */
export const createExamSelection = () =>
  createStore<ExamSelection>()((set) => ({
    select: (id) => set({ selected: id }),
    selected: null,
  }));
