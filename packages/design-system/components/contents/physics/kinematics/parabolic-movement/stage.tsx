"use client";

import {
  type getParabolicMotionState,
  PARABOLIC_SCENE,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { ProjectileBallScene } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/scene";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { getColor } from "@repo/design-system/lib/color";
import { Suspense } from "react";

/**
 * The three-dimensional scene of the parabolic lab. It loads apart from the lab's
 * controls, so a lab can hold its frame before its scene has loaded.
 */
export function ParabolicMovementStage({
  motion,
}: {
  motion: ReturnType<typeof getParabolicMotionState>;
}) {
  return (
    <ThreeCanvas frameloop="always">
      <Suspense>
        <ambientLight intensity={0.72} />
        <hemisphereLight
          color={getColor("SLATE", 50)}
          groundColor={getColor("SLATE", 400)}
          intensity={0.68}
        />
        <directionalLight
          castShadow
          intensity={1.35}
          position={[4.2, 5.5, 4.8]}
          shadow-bias={-0.0006}
          shadow-mapSize-height={1024}
          shadow-mapSize-width={1024}
          shadow-normalBias={0.02}
        />
        <directionalLight intensity={0.28} position={[-4, 3.2, -3.5]} />
        <CameraControls
          cameraPosition={PARABOLIC_SCENE.cameraPosition}
          cameraTarget={PARABOLIC_SCENE.cameraTarget}
          enablePan
          enableRotate
          enableZoom
          fov={PARABOLIC_SCENE.cameraFov}
        />
        <ProjectileBallScene motion={motion} />
      </Suspense>
    </ThreeCanvas>
  );
}
