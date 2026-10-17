import { createStore } from "zustand";

/**
 * The moment the ages of one list of a profile count from. A list starts from a
 * moment it is given, such as when the server read its first page, so the server
 * and the browser write the same words, and a timer then moves the moment to the
 * browser's clock.
 */
export interface AgeClock {
  /** Epoch milliseconds that the ages count from. */
  readonly now: number;
  /** Moves the moment to the given epoch milliseconds, which the timer reads. */
  readonly setNow: (now: number) => void;
}

/** Creates the clock of one list, starting from the moment it is given. */
export function createAgeClock(startAt: number) {
  return createStore<AgeClock>()((set) => ({
    now: startAt,
    setNow: (now) => set({ now }),
  }));
}
