"use client";

import {
  PROJECTILE_SCENE,
  type ProjectileMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { PirateProjectileScene } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/scene";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { getColor } from "@repo/design-system/lib/color";
import { Suspense } from "react";

const FLASH_COLOR = getColor("ORANGE", 500);

export interface FeaturesProjectileSceneProps {
  motion: ProjectileMotionState;
  shouldReduceMotion: boolean;
}

/** Loads the lesson's WebGL scene only after its semantic frame nears view. */
export function FeaturesProjectileScene({
  motion,
  shouldReduceMotion,
}: FeaturesProjectileSceneProps) {
  return (
    <ThreeCanvas frameloop={shouldReduceMotion ? "demand" : "always"}>
      <Suspense>
        <ambientLight intensity={0.62} />
        <hemisphereLight
          color={getColor("SKY", 400)}
          groundColor={getColor("TEAL", 700)}
          intensity={0.68}
        />
        <directionalLight
          castShadow
          intensity={1.35}
          position={[-3.4, 5.8, 4.7]}
          shadow-bias={-0.0006}
          shadow-mapSize-height={1024}
          shadow-mapSize-width={1024}
          shadow-normalBias={0.02}
        />
        <pointLight
          color={FLASH_COLOR}
          intensity={0.45}
          position={PROJECTILE_SCENE.launchOffset}
        />
        <CameraControls
          autoRotate={false}
          cameraPosition={PROJECTILE_SCENE.cameraPosition}
          cameraTarget={PROJECTILE_SCENE.cameraTarget}
          enablePan
          enableRotate
          enableZoom
          fov={PROJECTILE_SCENE.cameraFov}
          maxDistance={PROJECTILE_SCENE.maxDistance}
          minDistance={PROJECTILE_SCENE.minDistance}
        />
        <PirateProjectileScene motion={motion} />
      </Suspense>
    </ThreeCanvas>
  );
}
