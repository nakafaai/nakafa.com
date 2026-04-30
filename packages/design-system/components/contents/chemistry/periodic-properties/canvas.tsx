"use client";

import { useThree } from "@react-three/fiber";
import {
  getPeriodicPropertiesSceneColors,
  type PeriodicPropertyModeId,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
import { PeriodicPropertiesScene } from "@repo/design-system/components/contents/chemistry/periodic-properties/scene";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { useTheme } from "next-themes";
import { Suspense, useEffect } from "react";

const CAMERA_POSITION = [0, 4.2, 6.8] satisfies [number, number, number];
const NARROW_CAMERA_POSITION = [0, 4.5, 7.2] satisfies [number, number, number];
const CAMERA_TARGET = [0, 0.34, 0.28] satisfies [number, number, number];
const NARROW_CANVAS_ASPECT_RATIO = 1.25;

/**
 * Renders the periodic-properties trend model in a responsive 3D canvas.
 */
export function PeriodicPropertiesCanvas({
  "aria-label": ariaLabel,
  modeId,
}: {
  "aria-label": string;
  modeId: PeriodicPropertyModeId;
}) {
  const { resolvedTheme } = useTheme();
  const colors = getPeriodicPropertiesSceneColors(resolvedTheme);

  return (
    <section
      aria-label={ariaLabel}
      className="relative aspect-4/3 overflow-hidden rounded-md bg-card sm:aspect-16/10"
    >
      <ThreeCanvas
        camera={{ fov: 44, position: CAMERA_POSITION }}
        frameloop="demand"
      >
        <Suspense>
          <PeriodicPropertiesRenderSync key={modeId} />
          <ResponsivePeriodicPropertiesCamera />
          <ambientLight intensity={0.76} />
          <hemisphereLight
            color={colors.skyLight}
            groundColor={colors.groundLight}
            intensity={0.64}
          />
          <directionalLight intensity={1.25} position={[4, 7, 5]} />
          <PeriodicPropertiesScene colors={colors} modeId={modeId} />
        </Suspense>
      </ThreeCanvas>
    </section>
  );
}

/**
 * Requests a new frame after the active property changes in demand mode.
 */
function PeriodicPropertiesRenderSync() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  return null;
}

/**
 * Keeps the model readable on narrow screens while leaving orbit and zoom on.
 */
function ResponsivePeriodicPropertiesCamera() {
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
      maxDistance={12}
      minDistance={3}
    />
  );
}
