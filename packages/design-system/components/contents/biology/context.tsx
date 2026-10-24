import type { BiologySceneColors } from "@repo/design-system/components/contents/biology/data";
import { createContext, type ReactNode, use, useMemo } from "react";
import { createStore, type ExtractState, useStore } from "zustand";
import { combine } from "zustand/middleware";

/** Creates one biology lab's store, which holds the item its reader picked. */
export function createBiologyItemStore(initialItemIndex: number) {
  return createStore(
    combine({ selectedIndex: initialItemIndex }, (set) => ({
      selectItem: (selectedIndex: number) => set({ selectedIndex }),
    }))
  );
}

/** One biology lab's item store, created once per lab and carried by its provider. */
export type BiologyItemStore = ReturnType<typeof createBiologyItemStore>;

/** One biology lab's selected item and the action that changes it. */
type BiologyItemState = ExtractState<BiologyItemStore>;

interface BiologyLabProviderProps {
  children: ReactNode;
  colors: BiologySceneColors;
  store: BiologyItemStore;
}

const BiologyLabContext = createContext<Omit<
  BiologyLabProviderProps,
  "children"
> | null>(null);

/**
 * Provides the scene colors and the item store of one biology lab to its stage
 * and scenes. The value changes only with the colors, so a reader of the colors
 * never reruns when the reader picks another item.
 */
export function BiologyLabProvider({
  children,
  colors,
  store,
}: BiologyLabProviderProps) {
  const value = useMemo(() => ({ colors, store }), [colors, store]);

  return <BiologyLabContext value={value}>{children}</BiologyLabContext>;
}

function useBiologyLab() {
  const lab = use(BiologyLabContext);
  if (!lab) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("useBiologyLab must be used within BiologyLabProvider");
  }
  return lab;
}

/** Reads the scene colors of the surrounding biology lab. */
export function useBiologyColors() {
  return useBiologyLab().colors;
}

/** Selects one part of the surrounding lab's item, so a reader reruns only for it. */
export function useBiologyItemSelection<T>(
  selector: (state: BiologyItemState) => T
) {
  return useStore(useBiologyLab().store, selector);
}
