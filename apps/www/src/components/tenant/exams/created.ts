import type * as Ref from "@confect/core/Ref";
import type exams from "@repo/backend/confect/_generated/refs/exams";
import { createContext } from "react";
import { createStore, type StoreApi } from "zustand";

/** One exam as the editor reads it, which the create answers with. */
type CreatedView = Ref.Returns<typeof exams.exams.open>;

/** The exam a create of this school's exam pages answered with, until its editor has opened and closed. */
interface CreatedState {
  /** The exam the last create answered with, or none. */
  readonly held: CreatedView | null;
  /** Holds the exam that a create answered with, for the editor it opens next. */
  readonly hold: (view: CreatedView) => void;
  /** Lets the exam go once its editor closes, so a later visit reads the exam as it stands. */
  readonly release: (id: CreatedView["id"]) => void;
}

/**
 * Creates the store of one visit to a school's exam pages. A create holds the exam that the server answered
 * with, so the editor it opens draws the exam whole on its first frame, and a fresh read takes over as soon
 * as it answers. The editor lets the exam go when it closes, and a release of another exam leaves it held.
 */
export const createCreatedExams = () =>
  createStore<CreatedState>()((set) => ({
    held: null,
    hold: (view) => set({ held: view }),
    release: (id) =>
      set((state) => (state.held?.id === id ? { held: null } : state)),
  }));

/** The store of the exams created in this visit to the exam pages, which their layout gives every page. */
export const CreatedExamsContext = createContext<StoreApi<CreatedState> | null>(
  null
);
