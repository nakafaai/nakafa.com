import { createStore } from "zustand";
import type { DashboardAttempt } from "@/components/exams/sitting/change";
import type { SittingFilter } from "@/components/exams/sitting/seat";

/**
 * The state of one dashboard that its own actions write: the seat the proctor selected, and the
 * filter of the seats. The token is not held here, because the dashboard page carries it.
 */
export interface SittingStore {
  readonly choose: (attemptId: DashboardAttempt["id"] | null) => void;
  readonly chooseFilter: (filter: SittingFilter) => void;
  readonly filter: SittingFilter;
  readonly selected: DashboardAttempt["id"] | null;
}

/** Creates one store for one dashboard instance, so two dashboards never share a selection. */
export function createSittingStore() {
  return createStore<SittingStore>()((set) => ({
    chooseFilter: (filter) => set({ filter }),
    choose: (attemptId) => set({ selected: attemptId }),
    filter: "all",
    selected: null,
  }));
}
