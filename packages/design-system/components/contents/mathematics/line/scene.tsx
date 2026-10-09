"use client";

import type { ResolvedLine } from "@repo/design-system/components/contents/mathematics/line/spec";
import { CoordinateSystem } from "@repo/design-system/components/three/coordinate-system";
import { LineEquation } from "@repo/design-system/components/three/line-equation";
import { Array as Arr } from "effect";

/** Exact serializable payload owned by the deferred WebGL boundary. */
export interface LineSceneProps {
  cameraPosition: [number, number, number];
  cameraTarget?: [number, number, number];
  lines: readonly ResolvedLine[];
  showZAxis: boolean;
}

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
    Arr.every(lines, (line) =>
      Arr.every(line.points, (point) => point.z === 0)
    );

  return (
    <CoordinateSystem
      cameraPosition={cameraPosition}
      cameraProjection={isFrontalPlane ? { kind: "orthographic" } : undefined}
      cameraTarget={cameraTarget}
      showOrigin={
        !Arr.some(lines, (line) =>
          Boolean(line.endpoints?.start || line.endpoints?.end)
        )
      }
      showZAxis={showZAxis}
    >
      {Arr.map(lines, (line, index) => (
        <LineEquation
          // biome-ignore lint/suspicious/noArrayIndexKey: Authored order is stable, and coincident lines intentionally share every point.
          key={`line-${index}-${Arr.join(
            Arr.map(line.points, (point) => `${point.x},${point.y},${point.z}`),
            ";"
          )}`}
          {...line}
        />
      ))}
    </CoordinateSystem>
  );
}
