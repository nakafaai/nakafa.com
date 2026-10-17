import { createStore } from "zustand";

/**
 * The moment the ages of the posts count from. A list starts from the moment the
 * server read its first page, so the server and the browser write the same words,
 * and a timer then moves the moment to the browser's clock.
 */
export interface PostsClock {
  /** Epoch milliseconds that the ages count from. */
  readonly now: number;
  /** Moves the moment to the given epoch milliseconds, which the timer reads. */
  readonly setNow: (now: number) => void;
}

/** Creates the clock of one list, starting from the moment the server read its page. */
export function createPostsClock(serverNow: number) {
  return createStore<PostsClock>()((set) => ({
    now: serverNow,
    setNow: (now) => set({ now }),
  }));
}
