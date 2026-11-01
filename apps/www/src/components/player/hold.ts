import { Array as Arr } from "effect";
import { createStore } from "zustand";

/** The texts a paper waits for: more than the tallest screen shows at once, so what comes later lands below it. */
const HELD_TEXTS = 8;

/** The texts a paper still waits for, and the actions that end the wait. Only ever shrinks. */
export interface PaperHold {
  /** Ends the wait, for a text that never answers. */
  readonly release: () => void;
  /** Takes one text out of the wait, once it can draw. */
  readonly settle: (key: string) => void;
  /** The keys of the texts the paper still waits for. */
  readonly waiting: readonly string[];
}

/** Creates the wait of one paper, for the first of its `keys`. Each paper creates its own, once. */
export const createPaperHold = (keys: readonly string[]) =>
  createStore<PaperHold>()((set) => ({
    release: () => set({ waiting: [] }),
    settle: (key) =>
      set(({ waiting }) => ({
        waiting: Arr.filter(waiting, (held) => held !== key),
      })),
    waiting: Arr.take(keys, HELD_TEXTS),
  }));
