import { useThree } from "@react-three/fiber";
import { ShellModelScene } from "@repo/design-system/components/contents/chemistry/shell-model/scene";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Suspense } from "react";

const CAMERA_POSITION = [0, 7, 3.5] satisfies readonly [number, number, number];
const NARROW_CAMERA_POSITION = [0, 8, 4] satisfies readonly [
  number,
  number,
  number,
];
const CAMERA_TARGET = [0, 0, 0] satisfies readonly [number, number, number];
const NARROW_CANVAS_ASPECT_RATIO = 1.4;

/**
 * The three-dimensional shell model. It loads apart from the lab's controls, so
 * a lab can hold its frame before the model has loaded.
 */
export function ShellModelStage() {
  return (
    <ScienceStage frameloop="always">
      <Suspense>
        <ResponsiveShellModelCamera />
        <ShellModelScene />
      </Suspense>
    </ScienceStage>
  );
}

/**
 * Keeps shell diagrams framed on narrow screens while preserving orbit, pan,
 * and zoom controls for exploration.
 */
function ResponsiveShellModelCamera() {
  const size = useThree((state) => state.size);
  const cameraPosition = isNarrowThreeScene(size, NARROW_CANVAS_ASPECT_RATIO)
    ? NARROW_CAMERA_POSITION
    : CAMERA_POSITION;

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={CAMERA_TARGET}
      fov={45}
      framing="content"
    />
  );
}
