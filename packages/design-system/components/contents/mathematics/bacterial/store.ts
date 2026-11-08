import { createStore } from "zustand";
import { combine } from "zustand/middleware";

/**
 * One growth card's own state: the generation it shows, the view it was
 * chosen in, and how fast it plays. A reset of the card's view starts a new
 * view, which shows the first generation again.
 */
export function createBacteriaStore() {
  return createStore(
    combine({ generation: 0, speed: 1, view: 0 }, (set) => ({
      /** Plays the growth faster or slower. */
      pace: (speed: number) => set({ speed }),
      /** Shows one generation, counted within the view it was chosen in. */
      show: (generation: number, view: number) => set({ generation, view }),
    }))
  );
}

/** One growth card's store. */
export type BacteriaStore = ReturnType<typeof createBacteriaStore>;

/** The generation a card shows in its current view: the first after a reset. */
export function shownGeneration(
  state: { readonly generation: number; readonly view: number },
  view: number
) {
  return state.view === view ? state.generation : 0;
}
