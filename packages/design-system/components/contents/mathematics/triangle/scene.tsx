"use client";

import { useTriangle } from "@repo/design-system/components/contents/mathematics/triangle/context";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Triangle } from "@repo/design-system/components/three/triangle";

const CAMERA_Z_POSITION = 4;

/** Owns the WebGL imports and camera for the interactive triangle lesson. */
export function TriangleScene({ angle }: { angle: number }) {
  const { size } = useTriangle();

  return (
    <CoordinateSystem
      cameraFraming="content"
      cameraPosition={[0, 0, CAMERA_Z_POSITION]}
      cameraProjection={{ kind: "orthographic" }}
      showOrigin={false}
      showZAxis={false}
    >
      <Triangle
        angle={angle}
        position={[0.5 * size, 0.5 * size, 0]}
        size={size}
      />
    </CoordinateSystem>
  );
}
