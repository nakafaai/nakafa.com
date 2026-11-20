import { useRequired } from "@repo/design-system/hooks/required";
import type { ReactNode } from "react";
import { createContext, useState } from "react";
import type { ExtractState } from "zustand";
import { createStore, useStore } from "zustand";
import { combine } from "zustand/middleware";

/** A reaction lab opens on its reactants, with the faint products ahead of them. */
const initialProgress = { progress: 0 };

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
  return useRequired(ProgressContext, "useReactionProgress");
}

/** Selects one part of the surrounding reaction lab's progress. */
export function useReactionState<T>(
  selector: (state: ExtractState<ProgressStore>) => T
) {
  return useStore(useReactionProgress(), selector);
}
