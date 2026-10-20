import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createStore } from "zustand";
import type { SittingFilter } from "@/components/exams/sitting/seat";

/** A seat the proctor selected: its attempt, and the cursor of the dashboard page that holds it. */
const SittingSeat = Schema.Struct({
  attemptId: Id("examAttempts"),
  cursor: Schema.NullOr(Schema.String),
});

/**
 * The state of one dashboard that its own actions write: the seat the proctor selected, and the
 * filter of the seats. The token is not held here, because the dashboard page carries it.
 */
export interface SittingStore {
  readonly choose: (seat: typeof SittingSeat.Type | null) => void;
  readonly chooseFilter: (filter: SittingFilter) => void;
  readonly filter: SittingFilter;
  readonly selected: typeof SittingSeat.Type | null;
}

/** Creates one store for one dashboard instance, so two dashboards never share a selection. */
export function createSittingStore() {
  return createStore<SittingStore>()((set) => ({
    chooseFilter: (filter) => set({ filter }),
    choose: (seat) => set({ selected: seat }),
    filter: "all",
    selected: null,
  }));
}
