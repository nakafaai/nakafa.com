"use client";

import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { Triangle } from "@repo/design-system/components/three/triangle";
import type { ComponentProps } from "react";

const CAMERA_Z_POSITION = 4;

/** Owns the WebGL imports and camera for the interactive triangle lesson. */
export function TriangleScene({
  angle,
  labels,
  size,
}: Pick<ComponentProps<typeof Triangle>, "angle" | "labels" | "size">) {
  return (
    <CoordinateSystem
      cameraPosition={[0, 0, CAMERA_Z_POSITION]}
      className="size-full"
      showOrigin={false}
      showZAxis={false}
    >
      <Triangle angle={angle} labels={labels} size={size} />
    </CoordinateSystem>
  );
}
