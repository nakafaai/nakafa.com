import { useThree } from "@react-three/fiber";
import {
  getPeriodicPropertiesSceneColors,
  type PeriodicPropertyModeId,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
import { PeriodicPropertiesScene } from "@repo/design-system/components/contents/chemistry/periodic-properties/scene";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { VisualCardBody } from "@repo/design-system/components/visual/card";
import { useTheme } from "@repo/design-system/providers/theme";
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
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const colors = getPeriodicPropertiesSceneColors(resolvedTheme);

  return (
    <VisualCardBody
      aria-label={ariaLabel}
      className={threeSceneFrameVariants()}
      render={<section />}
    >
      <ScienceStage frameloop="demand">
        <Suspense>
          <PeriodicPropertiesRenderSync key={modeId} />
          <CameraControls
            cameraPosition={CAMERA_POSITION}
            cameraTarget={CAMERA_TARGET}
            fov={44}
            framing="content"
          />
          <PeriodicPropertiesScene colors={colors} modeId={modeId} />
        </Suspense>
      </ScienceStage>
    </VisualCardBody>
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
