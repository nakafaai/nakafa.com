"use client";

import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Triangle } from "@repo/design-system/components/three/triangle";
import type { ComponentProps } from "react";

const CAMERA_Z_POSITION = 4;

/** Owns the WebGL imports and camera for the interactive triangle lesson. */
export function TriangleScene({
  angle,
  size = 1,
}: Pick<ComponentProps<typeof Triangle>, "angle" | "size">) {
  return (
    <CoordinateSystem
      cameraPosition={[0, 0, CAMERA_Z_POSITION]}
      cameraProjection={{ kind: "orthographic" }}
      showOrigin={false}
    >
      <Triangle
        angle={angle}
        position={[1.5 * size, 1.5 * size, 0]}
        size={size}
      />
    </CoordinateSystem>
  );
}
