"use client";

import { GridIcon } from "@hugeicons/core-free-icons";
import { DropdownMenuCheckboxItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import {
  createContext,
  type ReactNode,
  use,
  useLayoutEffect,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { createStore, type ExtractState, useStore } from "zustand";
import { combine } from "zustand/middleware";

/** A scene that shows its grid. */
const initialControls = { showGrid: true };

/** Creates one card's controls: whether its scene shows the grid. */
function createControlsStore() {
  return createStore(
    combine(initialControls, (set) => ({
      toggleGrid: () => set((current) => ({ showGrid: !current.showGrid })),
    }))
  );
}

/** One card's controls store, shared by its scene and its actions. */
type ControlsStore = ReturnType<typeof createControlsStore>;

/** One card's controls and the actions that change them. */
type Controls = ExtractState<ControlsStore>;

const ControlsContext = createContext<ControlsStore | null>(null);

/**
 * Shares one card's controls between its scene and its actions through a
 * store, so each part re-renders only for the control it reads.
 */
export function CoordinateProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createControlsStore);

  // Activity disconnects scene effects while preserving the card's React state.
  useLayoutEffect(() => () => store.setState(initialControls), [store]);

  return <ControlsContext value={store}>{children}</ControlsContext>;
}

/** Selects one part of the surrounding coordinate controls. */
export function useCoordinateControls<T>(selector: (controls: Controls) => T) {
  const store = use(ControlsContext);
  if (!store) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("Coordinate controls require CoordinateProvider.");
  }
  return useStore(store, selector);
}

/**
 * The actions of a coordinate scene's visual card: the actions every scene has
 * (play, full screen, and the first view back in its menu), with the grid in the
 * same menu, checked while the scene shows it. The coordinate store owns the
 * grid, and the visual card owns play, the view and where the card is shown. A
 * static stand-in of the scene passes `inert`, so its controls take no focus
 * while the scene is not mounted.
 */
export function CoordinateControls({ inert = false }: { inert?: boolean }) {
  const t = useTranslations("Common");
  const showGrid = useCoordinateControls((controls) => controls.showGrid);
  const toggleGrid = useCoordinateControls((controls) => controls.toggleGrid);

  return (
    <VisualCardSceneActions inert={inert}>
      <DropdownMenuCheckboxItem
        checked={showGrid}
        closeOnClick
        onCheckedChange={toggleGrid}
      >
        <HugeIcons icon={GridIcon} />
        {t("grid")}
      </DropdownMenuCheckboxItem>
    </VisualCardSceneActions>
  );
}
