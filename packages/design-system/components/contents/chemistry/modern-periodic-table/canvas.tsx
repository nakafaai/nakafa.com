import { useThree } from "@react-three/fiber";
import { getModernPeriodicTableSceneColors } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/data";
import type { ModernPeriodicTableLabProps } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/lab";
import {
  ModernPeriodicTableScene,
  ModernPeriodicTableSceneProvider,
} from "@repo/design-system/components/contents/chemistry/modern-periodic-table/scene";
import type { ModernPeriodicTableFocusStore } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/store";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import {
  isNarrowThreeScene,
  threeSceneFrameVariants,
} from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { VisualCardBody } from "@repo/design-system/components/visual/card";
import { useTheme } from "@repo/design-system/providers/theme";
import { Suspense, useEffect, useMemo } from "react";
import { useStore } from "zustand";

const CAMERA_POSITION = [0, 10, 5.75] satisfies readonly [
  number,
  number,
  number,
];
const NARROW_CAMERA_POSITION = [0, 12, 6.75] satisfies readonly [
  number,
  number,
  number,
];
const CAMERA_TARGET = [0, 0, 0.75] satisfies readonly [number, number, number];
const NARROW_CANVAS_ASPECT_RATIO = 1.15;

/**
 * Renders the modern periodic table as a responsive model.
 */
export function ModernPeriodicTableCanvas({
  "aria-label": ariaLabel,
  labels,
  store,
}: {
  "aria-label": string;
  labels: ModernPeriodicTableLabProps["labels"];
  store: ModernPeriodicTableFocusStore;
}) {
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const focusId = useStore(store, (state) => state.focusId);
  const colors = useMemo(
    () => getModernPeriodicTableSceneColors(resolvedTheme),
    [resolvedTheme]
  );

  return (
    <VisualCardBody
      aria-label={ariaLabel}
      className={threeSceneFrameVariants()}
      render={<section />}
    >
      <ScienceStage frameloop="demand">
        <Suspense>
          <ModernPeriodicTableRenderSync key={focusId} />
          <ResponsiveModernPeriodicTableCamera />
          <ModernPeriodicTableSceneProvider
            colors={colors}
            labels={labels}
            store={store}
          >
            <ModernPeriodicTableScene />
          </ModernPeriodicTableSceneProvider>
        </Suspense>
      </ScienceStage>
    </VisualCardBody>
  );
}

/**
 * Requests a fresh demand-rendered frame whenever the selected table focus
 * changes. The parent key remounts this tiny sync component per focus.
 */
function ModernPeriodicTableRenderSync() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  return null;
}

/**
 * Keeps the wide table readable on narrow screens without disabling orbiting.
 */
function ResponsiveModernPeriodicTableCamera() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? NARROW_CAMERA_POSITION
    : CAMERA_POSITION;

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={CAMERA_TARGET}
      fov={42}
      framing="content"
    />
  );
}
