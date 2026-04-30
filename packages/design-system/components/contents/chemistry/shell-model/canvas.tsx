"use client";

import { useThree } from "@react-three/fiber";
import {
  getShellModelSceneColors,
  type ShellModelSample,
  type ShellModelShells,
} from "@repo/design-system/components/contents/chemistry/shell-model/data";
import { ShellModelScene } from "@repo/design-system/components/contents/chemistry/shell-model/scene";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { useTheme } from "next-themes";
import { Suspense } from "react";

const CAMERA_POSITION = [0, 3.4, 5.6] satisfies readonly [
  number,
  number,
  number,
];
const NARROW_CAMERA_POSITION = [0, 4.2, 7.2] satisfies readonly [
  number,
  number,
  number,
];
const CAMERA_TARGET = [0, 0, 0] satisfies readonly [number, number, number];
const NARROW_CANVAS_ASPECT_RATIO = 1.4;

/**
 * Renders the shared responsive 3D shell model used by chemistry shell labs.
 */
export function ShellModelCanvas({
  "aria-label": ariaLabel,
  outerShellKey,
  sample,
  shells,
}: {
  "aria-label": string;
  outerShellKey: string;
  sample: ShellModelSample;
  shells: ShellModelShells;
}) {
  const { resolvedTheme } = useTheme();
  const sceneColors = getShellModelSceneColors(resolvedTheme);

  return (
    <section
      aria-label={ariaLabel}
      className="relative aspect-16/10 overflow-hidden rounded-md bg-card"
    >
      <ThreeCanvas
        camera={{ fov: 45, position: CAMERA_POSITION }}
        frameloop="always"
      >
        <Suspense>
          <ResponsiveShellModelCamera />
          <ambientLight intensity={0.72} />
          <hemisphereLight
            color={sceneColors.skyLight}
            groundColor={sceneColors.groundLight}
            intensity={0.62}
          />
          <directionalLight intensity={1.3} position={[4, 6, 5]} />
          <ShellModelScene
            colors={sceneColors}
            outerShellKey={outerShellKey}
            sample={sample}
            shells={shells}
          />
        </Suspense>
      </ThreeCanvas>
    </section>
  );
}

/**
 * Keeps shell diagrams framed on narrow screens while preserving orbit, pan,
 * and zoom controls for exploration.
 */
function ResponsiveShellModelCamera() {
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
      maxDistance={10}
      minDistance={2}
    />
  );
}
