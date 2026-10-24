import type {
  ReactionCueId,
  ReactionSceneColors,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/data";
import { createContext, type ReactNode, use, useMemo } from "react";
import { createStore, type ExtractState, useStore } from "zustand";
import { combine } from "zustand/middleware";

/** Creates one lab's store, which holds the cue its reader picked. */
export function createReactionCueStore(initialCueId: ReactionCueId) {
  return createStore(
    combine({ cueId: initialCueId }, (set) => ({
      selectCue: (cueId: ReactionCueId) => set({ cueId }),
    }))
  );
}

/** One lab's cue store, created once per lab and carried by its provider. */
type ReactionCueStore = ReturnType<typeof createReactionCueStore>;

/** One lab's cue and the action that changes it. */
type ReactionCueState = ExtractState<ReactionCueStore>;

interface ReactionCharacteristicsSceneProviderProps {
  children: ReactNode;
  colors: ReactionSceneColors;
  store: ReactionCueStore;
}

const ReactionCharacteristicsSceneContext = createContext<Omit<
  ReactionCharacteristicsSceneProviderProps,
  "children"
> | null>(null);

/**
 * Provides the colors and the cue store of one lab to its scene. The value
 * changes only with the colors, so a reader of the colors never reruns when the
 * reader picks another cue.
 */
export function ReactionCharacteristicsSceneProvider({
  children,
  colors,
  store,
}: ReactionCharacteristicsSceneProviderProps) {
  const value = useMemo(() => ({ colors, store }), [colors, store]);

  return (
    <ReactionCharacteristicsSceneContext value={value}>
      {children}
    </ReactionCharacteristicsSceneContext>
  );
}

function useReactionCharacteristicsScene() {
  const scene = use(ReactionCharacteristicsSceneContext);
  if (!scene) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "useReactionCharacteristicsScene must be used within ReactionCharacteristicsSceneProvider"
    );
  }
  return scene;
}

/** Reads the colors of the surrounding lab. */
export function useReactionCharacteristicsColors() {
  return useReactionCharacteristicsScene().colors;
}

/** Selects one part of the surrounding lab's cue, so a reader reruns only for it. */
export function useReactionCharacteristicsCue<T>(
  selector: (state: ReactionCueState) => T
) {
  return useStore(useReactionCharacteristicsScene().store, selector);
}
