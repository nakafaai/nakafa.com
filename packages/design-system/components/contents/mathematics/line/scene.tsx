"use client";

import type { LineSceneProps } from "@repo/design-system/components/contents/mathematics/line/spec";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { LineEquation } from "@repo/design-system/components/three/line-equation";

/** Renders the client-only WebGL implementation of one line scene. */
export function LineScene({
  cameraPosition,
  cameraTarget,
  lines,
  showZAxis,
}: LineSceneProps) {
  return (
    <CoordinateSystem
      cameraPosition={cameraPosition}
      cameraTarget={cameraTarget}
      showGizmo={showZAxis}
      showZAxis={showZAxis}
    >
      {lines.map((line, index) => (
        <LineEquation
          // biome-ignore lint/suspicious/noArrayIndexKey: Authored order is stable, and coincident lines intentionally share every point.
          key={`line-${index}-${line.points.map((point) => `${point.x},${point.y},${point.z}`).join(";")}`}
          {...line}
        />
      ))}
    </CoordinateSystem>
  );
}
