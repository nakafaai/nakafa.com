"use client";

import type { LineSceneProps } from "@repo/design-system/components/contents/mathematics/line/spec";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { LineEquation } from "@repo/design-system/components/three/line-equation";

/** Renders the client-only WebGL implementation of one line scene. */
export function LineScene({
  cameraPosition,
  lines,
  showZAxis,
}: LineSceneProps) {
  return (
    <CoordinateSystem
      cameraPosition={cameraPosition}
      showGizmo={showZAxis}
      showZAxis={showZAxis}
    >
      {lines.map((line) => (
        <LineEquation
          key={`line-${line.points.map((point) => `${point.x},${point.y},${point.z}`).join(";")}`}
          {...line}
        />
      ))}
    </CoordinateSystem>
  );
}
