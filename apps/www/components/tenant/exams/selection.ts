import { Id } from "@repo/backend/confect/_generated/id";
import { QuestionView } from "@repo/backend/confect/exams/question";
import { Array as Arr, Option, Schema } from "effect";
import { createStore } from "zustand";
import type {
  Question,
  QuestionId,
} from "@/components/tenant/exams/optimistic";

/**
 * The data of one editor's selection: the question the teacher chose, or none before a
 * choice, and the questions that the server has not saved yet. A pending question is a
 * placeholder, so its actions wait for the server's answer.
 */
const SelectionState = Schema.Struct({
  pending: Schema.Array(Id("examQuestions")),
  selected: Schema.NullOr(Id("examQuestions")),
});

/** The actions of one editor's selection. */
interface SelectionActions {
  /** Ends the pending state of a question, once the server answered or refused it. */
  readonly endPending: (id: QuestionId) => void;
  /** Makes a question the one that the canvas shows. */
  readonly select: (id: QuestionId) => void;
  /** Marks a question as a placeholder that the server has not saved yet. */
  readonly startPending: (id: QuestionId) => void;
}

/** The state of one editor's selection, with its actions, as its store holds it. */
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
 * before a choice, the questions still being saved, and the actions that change them.
 * Each provider creates its own, once.
 */
export const createExamSelection = () =>
  createStore<ExamSelection>()((set) => ({
    endPending: (id) =>
      set((state) => ({
        pending: Arr.filter(state.pending, (current) => current !== id),
      })),
    pending: [],
    select: (id) => set({ selected: id }),
    selected: null,
    startPending: (id) =>
      set((state) => ({ pending: Arr.append(state.pending, id) })),
  }));
