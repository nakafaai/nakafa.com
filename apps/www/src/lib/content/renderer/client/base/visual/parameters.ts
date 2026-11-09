import { createStore } from "zustand";
import { combine } from "zustand/middleware";

/**
 * The value of every slider of one scene by its name. Moving a slider writes
 * here, and every formula that reads the name samples again.
 */
export function createParameterStore(values: Readonly<Record<string, number>>) {
  return createStore(
    combine({ values }, (set) => ({
      /** Moves one slider to a value its range allows. */
      move: (name: string, value: number) =>
        set((state) => ({ values: { ...state.values, [name]: value } })),
    }))
  );
}

/** One scene's slider store. */
export type ParameterStore = ReturnType<typeof createParameterStore>;
