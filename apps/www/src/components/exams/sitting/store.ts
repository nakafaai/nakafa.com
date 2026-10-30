import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";
import { createStore } from "zustand";
import type { SittingFilter } from "@/components/exams/sitting/seat";

/** A seat the reader is on: its attempt, and the cursor of the dashboard page that holds it. */
const SittingSeat = Schema.Struct({
  attemptId: Id("examAttempts"),
  cursor: Schema.NullOr(Schema.String),
});

/**
 * The state of one dashboard that its own actions write: the seat the reader is on, and the filter of
 * the seats. The seat the proctor selected lives in the dashboard's address, so a seat works as a
 * link before the page's script runs, and the token is not held here, because the page carries it.
 */
export interface SittingStore {
  readonly chooseFilter: (filter: SittingFilter) => void;
  readonly filter: SittingFilter;
  /** The seat the reader's pointer or focus is on, whose panel data loads before the seat is chosen. */
  readonly onSeat: typeof SittingSeat.Type | null;
  readonly warm: (seat: typeof SittingSeat.Type) => void;
}

/** Creates one store for one dashboard instance, so two dashboards never share a selection. */
export function createSittingStore() {
  return createStore<SittingStore>()((set) => ({
    chooseFilter: (filter) => set({ filter }),
    filter: "all",
    onSeat: null,
    // A seat the reader's pointer or focus reaches is the one a click chooses next, so its
    // panel data starts to load here. A repeat of the same seat changes nothing.
    warm: (seat) =>
      set((state) =>
        state.onSeat?.attemptId === seat.attemptId &&
        state.onSeat.cursor === seat.cursor
          ? state
          : { onSeat: seat }
      ),
  }));
}
