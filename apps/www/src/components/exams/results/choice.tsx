import { StudentRow } from "@repo/backend/confect/exams/results/contract";
import { Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/** The student whose answers the results page shows beside the list, or none. */
const ChoiceState = Schema.Struct({ chosen: Schema.NullOr(StudentRow) });

/** The actions that choose a student and close the answers. */
interface ChoiceActions {
  /** Shows a student's answers, or closes them when the student is already chosen. */
  readonly choose: (row: typeof StudentRow.Type) => void;
  readonly clear: () => void;
}

/** The choice of one results page, with its actions. */
type ResultsChoice = typeof ChoiceState.Type & ChoiceActions;

/** Creates the choice of one results page, with no student chosen. */
const createResultsChoice = () =>
  createStore<ResultsChoice>()((set) => ({
    choose: (row) =>
      set((state) => ({
        chosen: state.chosen?.attemptId === row.attemptId ? null : row,
      })),
    chosen: null,
    clear: () => set({ chosen: null }),
  }));

const ChoiceContext = createContext<StoreApi<ResultsChoice> | null>(null);

/** Gives a results page the student it shows beside the list, created once for the page. */
export function ResultsChoiceProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createResultsChoice);

  return <ChoiceContext value={store}>{children}</ChoiceContext>;
}

/** Reads one selected slice of the results page's choice. */
export function useResultsChoice<T>(selector: (state: ResultsChoice) => T) {
  const store = use(ChoiceContext);

  if (store === null) {
    throw new Error(
      "useResultsChoice must be used within ResultsChoiceProvider"
    );
  }

  return useStore(store, selector);
}
