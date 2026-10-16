"use client";

import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { UnitCircle as UnitCircle3D } from "@repo/design-system/components/three/unit-circle";

const CAMERA_Z_POSITION = 4;

/**
 * The three-dimensional unit circle, drawn at one angle in its own coordinate
 * system. It loads apart from the card's controls.
 */
export function UnitCircleStage({
  angle,
  viewLabel,
}: {
  angle: number;
  viewLabel: string | undefined;
}) {
  return (
    <CoordinateSystem
      aria-label={viewLabel}
      cameraPosition={[0, 0, CAMERA_Z_POSITION]}
      cameraProjection={{ kind: "orthographic" }}
      showOrigin={false}
    >
      <UnitCircle3D angle={angle} />
    </CoordinateSystem>
  );
}
