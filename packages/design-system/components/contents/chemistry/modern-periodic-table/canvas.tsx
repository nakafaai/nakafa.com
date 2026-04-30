"use client";

import { useThree } from "@react-three/fiber";
import {
  getModernPeriodicTableSceneColors,
  type ModernPeriodicTableFocusId,
  type ModernPeriodicTableLabLabels,
} from "@repo/design-system/components/contents/chemistry/modern-periodic-table/data";
import { ModernPeriodicTableScene } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/scene";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { useTheme } from "next-themes";
import { Suspense, useEffect } from "react";

const CAMERA_POSITION = [0, 6.8, 7.6] satisfies readonly [
  number,
  number,
  number,
];
const NARROW_CAMERA_POSITION = [0, 7.4, 8.2] satisfies readonly [
  number,
  number,
  number,
];
const CAMERA_TARGET = [0, 0, 0.35] satisfies readonly [number, number, number];
const NARROW_CANVAS_ASPECT_RATIO = 1.15;

/**
 * Renders the modern periodic table as a responsive 3D model.
 */
export function ModernPeriodicTableCanvas({
  "aria-label": ariaLabel,
  focusId,
  labels,
}: {
  "aria-label": string;
  focusId: ModernPeriodicTableFocusId;
  labels: ModernPeriodicTableLabLabels;
}) {
  const { resolvedTheme } = useTheme();
  const colors = getModernPeriodicTableSceneColors(resolvedTheme);

  return (
    <section
      aria-label={ariaLabel}
      className="relative aspect-4/3 overflow-hidden rounded-md bg-card sm:aspect-16/10"
    >
      <ThreeCanvas
        camera={{ fov: 42, position: CAMERA_POSITION }}
        frameloop="demand"
      >
        <Suspense>
          <ModernPeriodicTableRenderSync key={focusId} />
          <ResponsiveModernPeriodicTableCamera />
          <ambientLight intensity={0.74} />
          <hemisphereLight
            color={colors.skyLight}
            groundColor={colors.groundLight}
            intensity={0.62}
          />
          <directionalLight intensity={1.25} position={[4, 7, 5]} />
          <ModernPeriodicTableScene
            colors={colors}
            focusId={focusId}
            labels={labels}
          />
        </Suspense>
      </ThreeCanvas>
    </section>
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
  const cameraPosition =
    size.width < size.height * NARROW_CANVAS_ASPECT_RATIO
      ? NARROW_CAMERA_POSITION
      : CAMERA_POSITION;

  return (
    <CameraControls
      autoRotate={false}
      cameraPosition={cameraPosition}
      cameraTarget={CAMERA_TARGET}
      maxDistance={14}
      minDistance={4}
    />
  );
}
