"use client";

import {
  GridIcon,
  GridOffIcon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { CardFooter } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { createContext, useContextSelector } from "use-context-selector";

interface Controls {
  play: boolean;
  showGrid: boolean;
  toggleGrid: () => void;
  togglePlay: () => void;
}

const missingControls = Symbol("missing-coordinate-controls");

const ControlsContext = createContext<Controls | typeof missingControls>(
  missingControls
);

/** Shares interaction state between the scene body and its owning card footer. */
export function CoordinateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ play: false, showGrid: true });
  const toggleGrid = useCallback(() => {
    setState((current) => ({ ...current, showGrid: !current.showGrid }));
  }, []);
  const togglePlay = useCallback(() => {
    setState((current) => ({ ...current, play: !current.play }));
  }, []);
  const controls = useMemo(
    () => ({ ...state, toggleGrid, togglePlay }),
    [state, toggleGrid, togglePlay]
  );

  // Activity disconnects scene effects while preserving the card's React state.
  useLayoutEffect(() => () => setState({ play: false, showGrid: true }), []);

  return (
    <ControlsContext.Provider value={controls}>
      {children}
    </ControlsContext.Provider>
  );
}

/** Selects one part of the surrounding coordinate controls. */
export function useCoordinateControls<T>(selector: (controls: Controls) => T) {
  const selected = useContextSelector(ControlsContext, (value) =>
    value === missingControls ? missingControls : selector(value)
  );
  if (selected === missingControls) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error("Coordinate controls require CoordinateProvider.");
  }
  return selected;
}

/** The actual card footer, composed as a sibling of CardContent. */
export function CoordinateControls({ children }: { children?: ReactNode }) {
  const t = useTranslations("Common");
  const play = useCoordinateControls((controls) => controls.play);
  const showGrid = useCoordinateControls((controls) => controls.showGrid);
  const toggleGrid = useCoordinateControls((controls) => controls.toggleGrid);
  const togglePlay = useCoordinateControls((controls) => controls.togglePlay);

  return (
    <CardFooter
      className="flex-col items-stretch gap-4 border-t px-0"
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
      </div>
      {children}
    </CardFooter>
  );
}
