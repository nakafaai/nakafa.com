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
  /** The question whose grip takes the keyboard focus once the order it moved in shows, or none. */
  focus: Schema.NullOr(Id("examQuestions")),
  pending: Schema.Array(Id("examQuestions")),
  /** Whether the chosen question is held, so the scroll that brings it into view does not choose another. */
  pinned: Schema.Boolean,
  selected: Schema.NullOr(Id("examQuestions")),
});

/** The actions of one editor's selection. */
interface SelectionActions {
  /** Ends the pending state of a question, once the server answered or refused it. */
  readonly endPending: (id: QuestionId) => void;
  /** Chooses a question and holds it, so the canvas keeps it chosen while it scrolls to it. */
  readonly pin: (id: QuestionId) => void;
  /**
   * Replaces a placeholder with the question the server answered for: the saved question
   * when it saved, or the question chosen before when it refused. It acts only while the
   * placeholder is still the chosen question, so a question the teacher chose meanwhile
   * stays chosen.
   */
  readonly replace: (placeholder: QuestionId, next: QuestionId | null) => void;
  /**
   * Asks for the keyboard focus on the grip of a question, once the page shows the order it moved in. A
   * move by the keyboard or by a page's own button keeps the focus on the moved page this way.
   */
  readonly requestFocus: (id: QuestionId) => void;
  /** Makes a question the one that the canvas shows. */
  readonly select: (id: QuestionId) => void;
  /** Ends the focus request once the page has taken the focus. */
  readonly settleFocus: () => void;
  /** Marks a question as a placeholder that the server has not saved yet. */
  readonly startPending: (id: QuestionId) => void;
  /** Releases the held question, so the canvas chooses the page the teacher scrolls to again. */
  readonly unpin: () => void;
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
 * The question the canvas moves to once `removed` leaves the exam, while the teacher is on it: the question
 * after it, or the one before it when it is the last, as a design tool moves to the next page of a deleted
 * one. None while the teacher is on another question, which stays, or when it is the only question.
 */
export const afterRemoval = (
  questions: readonly Question[],
  selected: QuestionId | null,
  removed: QuestionId
): Option.Option<QuestionId> =>
  Option.flatMap(activeQuestion(questions, selected), ({ index, question }) =>
    question.id === removed
      ? Option.map(
          Option.orElse(Arr.get(questions, index + 1), () =>
            Arr.get(questions, index - 1)
          ),
          (neighbour) => neighbour.id
        )
      : Option.none()
  );

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
    focus: null,
    pending: [],
    pin: (id) => set({ pinned: true, selected: id }),
    pinned: false,
    replace: (placeholder, next) =>
      set((state) =>
        state.selected === placeholder ? { selected: next } : {}
      ),
    requestFocus: (id) => set({ focus: id }),
    select: (id) => set({ selected: id }),
    selected: null,
    settleFocus: () => set({ focus: null }),
    startPending: (id) =>
      set((state) => ({ pending: Arr.append(state.pending, id) })),
    unpin: () => set({ pinned: false }),
  }));
