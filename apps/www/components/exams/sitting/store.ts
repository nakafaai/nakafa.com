import { createStore } from "zustand";
import type { DashboardAttempt } from "@/components/exams/sitting/change";
import type { SittingFilter } from "@/components/exams/sitting/seat";

/**
 * The state of one dashboard that its own actions write: the seat the proctor selected, the
 * filter of the seats, and the token that the last change returned. The token is held only
 * for this session, because the dashboard query never returns it.
 */
export interface SittingStore {
  readonly choose: (attemptId: DashboardAttempt["id"] | null) => void;
  readonly chooseFilter: (filter: SittingFilter) => void;
  readonly filter: SittingFilter;
  readonly selected: DashboardAttempt["id"] | null;
  readonly setToken: (token: string) => void;
  readonly token: string | null;
}

/** Creates one store for one dashboard instance, so two dashboards never share a selection. */
export function createSittingStore() {
  return createStore<SittingStore>()((set) => ({
    chooseFilter: (filter) => set({ filter }),
    choose: (attemptId) => set({ selected: attemptId }),
    filter: "all",
    selected: null,
    setToken: (token) => set({ token }),
    token: null,
  }));
}
