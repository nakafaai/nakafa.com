import type { GenericId } from "@confect/core";
import { createContext, type ReactNode, use, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/**
 * The student a results screen shows beside its students' list (two panes): the attempt the teacher
 * chose, or none while no row is chosen. The store holds the choice the rows write and the panel reads.
 */
interface ResultsSelection {
  readonly choose: (attemptId: GenericId.GenericId<"examAttempts"> | null) => void;
  readonly selected: GenericId.GenericId<"examAttempts"> | null;
}

/** Creates the selection of one results screen, with no student chosen. */
const createResultsSelection = () =>
  createStore<ResultsSelection>()((set) => ({
    choose: (selected) => set({ selected }),
    selected: null,
  }));

const SelectionContext = createContext<StoreApi<ResultsSelection> | null>(
  null
);

/** Gives one results screen its selection, created once for the screen. */
export function ResultsSelectionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createResultsSelection);

  return <SelectionContext value={store}>{children}</SelectionContext>;
}

/** Reads one slice of the results screen's selection. */
export function useResultsSelection<T>(
  selector: (state: ResultsSelection) => T
) {
  const store = use(SelectionContext);
  if (store === null) {
    throw new Error(
      "useResultsSelection must be used within ResultsSelectionProvider"
    );
  }
  return useStore(store, selector);
}
