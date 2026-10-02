"use client";

import {
  GridIcon,
  GridOffIcon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  VisualCardFooter,
  VisualCardFullscreen,
} from "@repo/design-system/components/visual/card";
import { useTranslations } from "next-intl";
import {
  createContext,
  type ReactNode,
  use,
  useLayoutEffect,
  useState,
} from "react";
import { createStore, type StoreApi, useStore } from "zustand";

interface Controls {
  play: boolean;
  showGrid: boolean;
  toggleGrid: () => void;
  togglePlay: () => void;
}

const initialControls = { play: false, showGrid: true };

/** Creates one card's controls: whether its scene plays and shows the grid. */
function createControlsStore() {
  return createStore<Controls>()((set) => ({
    ...initialControls,
    toggleGrid: () => set((current) => ({ showGrid: !current.showGrid })),
    togglePlay: () => set((current) => ({ play: !current.play })),
  }));
}

const ControlsContext = createContext<StoreApi<Controls> | null>(null);

/**
 * Shares one card's controls between its scene and its footer through a
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
 * The footer of a coordinate scene's visual card: the grid and automatic
 * rotation beside the card's full screen action, above any readout the scene
 * adds. The coordinate store owns the grid and rotation, and the visual card
 * owns where the card is shown.
 */
export function CoordinateControls({ children }: { children?: ReactNode }) {
  const t = useTranslations("Common");
  const play = useCoordinateControls((controls) => controls.play);
  const showGrid = useCoordinateControls((controls) => controls.showGrid);
  const toggleGrid = useCoordinateControls((controls) => controls.toggleGrid);
  const togglePlay = useCoordinateControls((controls) => controls.togglePlay);

  return (
    <VisualCardFooter
      className="flex-col items-stretch px-0"
      data-coordinate-controls=""
    >
      <div className="flex gap-2 px-(--card-spacing)">
        <Button
          aria-pressed={showGrid}
          onClick={toggleGrid}
          size="icon"
          variant="secondary"
        >
          <HugeIcons icon={showGrid ? GridIcon : GridOffIcon} />
          <span className="sr-only">{t("grid")}</span>
        </Button>
        <Button
          aria-pressed={play}
          onClick={togglePlay}
          size="icon"
          variant={play ? "secondary" : "default"}
        >
          <HugeIcons icon={play ? PauseIcon : PlayIcon} />
          <span className="sr-only">{t("automatic-rotation")}</span>
        </Button>
        <VisualCardFullscreen />
      </div>
      {children}
    </VisualCardFooter>
  );
}
