"use client";

import { useThree } from "@react-three/fiber";
import {
  getPeriodicPropertiesSceneColors,
  type PeriodicPropertyModeId,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
import { PeriodicPropertiesScene } from "@repo/design-system/components/contents/chemistry/periodic-properties/scene";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { useTheme } from "next-themes";
import { Suspense, useEffect } from "react";

const CAMERA_POSITION = [0, 10, 3] satisfies [number, number, number];
const CAMERA_TARGET = [-0.65, 0.45, 0.6] satisfies [number, number, number];
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
    <section aria-label={ariaLabel} className={threeSceneFrameVariants()}>
      <ThreeCanvas frameloop="demand">
        <Suspense>
          <PeriodicPropertiesRenderSync key={modeId} />
          <CameraControls
            autoRotate={false}
            cameraPosition={CAMERA_POSITION}
            cameraTarget={CAMERA_TARGET}
            fov={44}
            framing="content"
          />
          <ambientLight intensity={0.76} />
          <hemisphereLight
            color={colors.skyLight}
            groundColor={colors.groundLight}
            intensity={0.64}
          />
          <directionalLight
            castShadow
            intensity={1.25}
            position={[4, 7, 5]}
            shadow-bias={-0.0006}
            shadow-mapSize-height={1024}
            shadow-mapSize-width={1024}
            shadow-normalBias={0.02}
          />
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
