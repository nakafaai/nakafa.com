import type {
  ChemicalReactionTypeId,
  ChemicalReactionTypeSceneColors,
} from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/data";
import { createContext, type ReactNode, use, useMemo } from "react";
import { createStore, type ExtractState, useStore } from "zustand";
import { combine } from "zustand/middleware";

/** Creates one lab's store, which holds the reaction type its reader picked. */
export function createChemicalReactionTypeStore(
  initialTypeId: ChemicalReactionTypeId
) {
  return createStore(
    combine({ typeId: initialTypeId }, (set) => ({
      selectType: (typeId: ChemicalReactionTypeId) => set({ typeId }),
    }))
  );
}

/** One lab's reaction type store, created once per lab and carried by its provider. */
type ChemicalReactionTypeStore = ReturnType<
  typeof createChemicalReactionTypeStore
>;

/** One lab's reaction type and the action that changes it. */
type ChemicalReactionTypeState = ExtractState<ChemicalReactionTypeStore>;

interface ChemicalReactionTypeSceneProviderProps {
  children: ReactNode;
  colors: ChemicalReactionTypeSceneColors;
  store: ChemicalReactionTypeStore;
}

const ChemicalReactionTypeSceneContext = createContext<Omit<
  ChemicalReactionTypeSceneProviderProps,
  "children"
> | null>(null);

/**
 * Provides the colors and the reaction type store of one lab to its scene. The
 * value changes only with the colors, so a reader of the colors never reruns
 * when the reader picks another reaction type.
 */
export function ChemicalReactionTypeSceneProvider({
  children,
  colors,
  store,
}: ChemicalReactionTypeSceneProviderProps) {
  const value = useMemo(() => ({ colors, store }), [colors, store]);

  return (
    <ChemicalReactionTypeSceneContext value={value}>
      {children}
    </ChemicalReactionTypeSceneContext>
  );
}

/** Reads the colors and the reaction type store of the surrounding lab. */
export function useChemicalReactionTypeScene() {
  const scene = use(ChemicalReactionTypeSceneContext);
  if (!scene) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "useChemicalReactionTypeScene must be used within ChemicalReactionTypeSceneProvider"
    );
  }
  return scene;
}

/** Selects one part of the surrounding lab's reaction type, so a reader reruns only for it. */
export function useChemicalReactionTypeSelection<T>(
  selector: (state: ChemicalReactionTypeState) => T
) {
  return useStore(useChemicalReactionTypeScene().store, selector);
}
