import type { ModernPeriodicTableFocusId } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/data";
import { createStore, type ExtractState } from "zustand";
import { combine } from "zustand/middleware";

/** Creates one lab's store, which holds the table focus its reader picked. */
export function createModernPeriodicTableFocusStore(
  initialFocusId: ModernPeriodicTableFocusId
) {
  return createStore(
    combine({ focusId: initialFocusId }, (set) => ({
      selectFocus: (focusId: ModernPeriodicTableFocusId) => set({ focusId }),
    }))
  );
}

/** One lab's focus store, created once per lab and carried by its provider. */
export type ModernPeriodicTableFocusStore = ReturnType<
  typeof createModernPeriodicTableFocusStore
>;

/** One lab's focus and the action that changes it. */
export type ModernPeriodicTableFocusState =
  ExtractState<ModernPeriodicTableFocusStore>;
