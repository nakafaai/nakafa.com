import { PARABOLIC_SCENE } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { ProjectileBallScene } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/scene";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Suspense } from "react";

/**
 * The three-dimensional scene of the parabolic lab. It loads apart from the lab's
 * controls, so a lab can hold its frame before its scene has loaded. The scene reads
 * the lab's motion from `ParabolicMotionProvider`.
 */
export function ParabolicMovementStage() {
  return (
    <ScienceStage floor={0} frameloop="always">
      <Suspense>
        <CameraControls
          cameraPosition={PARABOLIC_SCENE.cameraPosition}
          cameraTarget={PARABOLIC_SCENE.cameraTarget}
          enablePan
          enableRotate
          enableZoom
          fov={PARABOLIC_SCENE.cameraFov}
        />
        <ProjectileBallScene />
      </Suspense>
    </ScienceStage>
  );
}
