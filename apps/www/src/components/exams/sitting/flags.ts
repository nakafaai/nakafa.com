import { Array as Arr } from "effect";
import { createStore } from "zustand";

/**
 * The questions that the student flagged for review in one attempt. The screen writes them, and the
 * browser keeps each change, so a reload shows the same flags.
 */
export interface FlagStore {
  readonly flagged: readonly string[];
  /** Flags the question when it is not flagged, and unflags it when it is. */
  readonly toggle: (questionId: string) => void;
}

/**
 * Creates the flags of one attempt, starting from the flags that the browser kept. A change is written to
 * the browser at once through `keep`, after the store shows it.
 */
export function createFlagStore(input: {
  readonly flagged: readonly string[];
  readonly keep: (questionId: string, flagged: boolean) => void;
}) {
  return createStore<FlagStore>()((set, get) => ({
    flagged: input.flagged,
    toggle: (questionId) => {
      const { flagged } = get();
      const next = !Arr.contains(flagged, questionId);
      set({
        flagged: next
          ? Arr.append(flagged, questionId)
          : Arr.filter(flagged, (id) => id !== questionId),
      });
      input.keep(questionId, next);
    },
  }));
}
