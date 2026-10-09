"use client";

import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { triangulatePolygon } from "@repo/design-system/lib/geometry/polygon";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { type ColorRepresentation, DoubleSide } from "three";

/** Composes a translucent planar region with the shared line and scene primitives. */
export function Polygon({
  color,
  opacity = 0.12,
  vertices,
}: {
  readonly color: ColorRepresentation;
  readonly opacity?: number;
  readonly vertices: readonly Point3[];
}) {
  const positions = useMemo(
    () => new Float32Array(Arr.flatMap(vertices, ({ x, y, z }) => [x, y, z])),
    [vertices]
  );
  const indices = useMemo(
    () => new Uint32Array(triangulatePolygon(vertices)),
    [vertices]
  );
  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute args={[positions, 3]} attach="attributes-position" />
        <bufferAttribute args={[indices, 1]} attach="index" />
      </bufferGeometry>
      <meshBasicMaterial
        color={color}
        depthWrite={false}
        opacity={opacity}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
        side={DoubleSide}
        transparent
      />
    </mesh>
  );
}
