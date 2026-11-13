import { createContext, type ReactNode, use, useState } from "react";
import { createStore, type ExtractState, useStore } from "zustand";
import { combine } from "zustand/middleware";

/** A reaction lab opens on its products, so its still frame shows the outcome. */
const initialProgress = { progress: 1 };

/** Creates one reaction lab's progress: how far its run has gone, 0 to 1. */
function createProgressStore() {
  return createStore(
    combine(initialProgress, (set) => ({
      /** Moves the run: the scene while the card plays, the slider by hand. */
      setProgress: (progress: number) => set({ progress }),
    }))
  );
}

/** One reaction lab's progress store, shared by its scene and its slider. */
type ProgressStore = ReturnType<typeof createProgressStore>;

const ProgressContext = createContext<ProgressStore | null>(null);

/** Shares one reaction lab's progress between its scene and its slider. */
export function ReactionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createProgressStore);

  return <ProgressContext value={store}>{children}</ProgressContext>;
}

/** Reads the surrounding reaction lab's progress store. */
export function useReactionProgress() {
  const store = use(ProgressContext);
  if (!store) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("Reaction progress requires ReactionProvider.");
  }
  return store;
}

/** Selects one part of the surrounding reaction lab's progress. */
export function useReactionState<T>(
  selector: (state: ExtractState<ProgressStore>) => T
) {
  return useStore(useReactionProgress(), selector);
}
