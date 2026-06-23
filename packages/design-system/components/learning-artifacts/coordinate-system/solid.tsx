"use client";

import { useMemo } from "react";
import { readScalarNumber, readVector3 } from "./model/numeric";
import type { CoordinatePrimitiveView } from "./model/view";

/**
 * Renders closed coordinate solids from compact exact primitive contracts.
 */
export function ClosedPrimitive({
  color,
  primitive,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "cuboid" | "sphere" }>;
}) {
  return primitive.kind === "cuboid" ? (
    <CuboidPrimitive color={color} primitive={primitive} />
  ) : (
    <SpherePrimitive color={color} primitive={primitive} />
  );
}

/**
 * Renders a cuboid from exact min/max corners without storing vertex clouds.
 */
function CuboidPrimitive({
  color,
  primitive,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "cuboid" }>;
}) {
  const box = useMemo(() => readCuboidBox(primitive), [primitive]);
  if (!box) {
    return null;
  }

  return (
    <mesh position={box.center}>
      <boxGeometry args={[box.size.x, box.size.y, box.size.z]} />
      <meshStandardMaterial
        color={color}
        opacity={0.18}
        transparent
        wireframe
      />
    </mesh>
  );
}

/**
 * Renders an exact sphere center and radius.
 */
function SpherePrimitive({
  color,
  primitive,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "sphere" }>;
}) {
  const center = useMemo(() => readVector3(primitive.center), [primitive]);
  const radius = readScalarNumber(primitive.radius);
  if (!(center && radius !== undefined)) {
    return null;
  }

  return (
    <mesh position={center}>
      <sphereGeometry args={[radius, 32, 16]} />
      <meshStandardMaterial
        color={color}
        opacity={0.18}
        transparent
        wireframe
      />
    </mesh>
  );
}

/**
 * Reads a cuboid center and dimensions from exact min/max corners.
 */
function readCuboidBox(
  primitive: Extract<CoordinatePrimitiveView, { kind: "cuboid" }>
) {
  const min = readVector3(primitive.min);
  const max = readVector3(primitive.max);
  if (!(min && max)) {
    return;
  }

  return {
    center: min.clone().add(max).multiplyScalar(0.5),
    size: max.clone().sub(min),
  };
}
