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
  const isFrontalPlane =
    cameraPosition[0] === (cameraTarget?.[0] ?? 0) &&
    cameraPosition[1] === (cameraTarget?.[1] ?? 0) &&
    lines.every((line) => line.points.every((point) => point.z === 0));

  return (
    <CoordinateSystem
      cameraPosition={cameraPosition}
      cameraProjection={isFrontalPlane ? { kind: "orthographic" } : undefined}
      cameraTarget={cameraTarget}
      showOrigin={
        !lines.some((line) => line.endpoints?.start || line.endpoints?.end)
      }
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
