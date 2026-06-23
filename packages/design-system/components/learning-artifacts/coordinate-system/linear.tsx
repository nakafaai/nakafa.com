"use client";

import { LineEquation } from "@repo/design-system/components/three/line-equation";
import { useMemo } from "react";
import { Vector3 } from "three";
import { readVector3 } from "./model/numeric";
import type { CoordinatePrimitiveView } from "./model/view";

const POINT_RADIUS = 0.18;
const LINE_WIDTH = 5;
const ARROW_SIZE = 0.36;

/**
 * Renders exact point and line-family primitives from compact contracts.
 */
export function LinearPrimitive({
  color,
  primitive,
  size,
}: {
  color: string;
  primitive: Extract<
    CoordinatePrimitiveView,
    { kind: "line" | "point" | "ray" | "segment" | "vector" }
  >;
  size: number;
}) {
  switch (primitive.kind) {
    case "point":
      return <PointPrimitive color={color} primitive={primitive} />;
    case "vector":
      return <VectorPrimitive color={color} primitive={primitive} />;
    case "segment":
      return <SegmentPrimitive color={color} primitive={primitive} />;
    case "ray":
      return <RayPrimitive color={color} primitive={primitive} size={size} />;
    case "line":
      return <LinePrimitive color={color} primitive={primitive} size={size} />;
    default:
      return null;
  }
}

/**
 * Renders one exact coordinate point with a small sphere.
 */
function PointPrimitive({
  color,
  primitive,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "point" }>;
}) {
  const point = useMemo(() => readVector3(primitive.point), [primitive]);
  if (!point) {
    return null;
  }

  return (
    <mesh position={point}>
      <sphereGeometry args={[POINT_RADIUS, 16, 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/**
 * Renders one vector from its optional tail and exact direction components.
 */
function VectorPrimitive({
  color,
  primitive,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "vector" }>;
}) {
  const points = useMemo(() => {
    const tail = primitive.tail ? readVector3(primitive.tail) : new Vector3();
    const vector = readVector3(primitive.vector);
    if (!(tail && vector)) {
      return [];
    }

    return [tail, tail.clone().add(vector)];
  }, [primitive]);

  return (
    <PrimitiveLine
      color={color}
      label={primitive.label}
      points={points}
      showArrow
    />
  );
}

/**
 * Renders a bounded exact line segment.
 */
function SegmentPrimitive({
  color,
  primitive,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "segment" }>;
}) {
  const points = useMemo(() => {
    const start = readVector3(primitive.start);
    const end = readVector3(primitive.end);
    return start && end ? [start, end] : [];
  }, [primitive]);

  return (
    <PrimitiveLine
      color={color}
      label={primitive.label}
      points={points}
      showArrow
    />
  );
}

/**
 * Renders a ray using a viewport-bounded line from exact direction.
 */
function RayPrimitive({
  color,
  primitive,
  size,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "ray" }>;
  size: number;
}) {
  const points = useMemo(() => {
    const origin = readVector3(primitive.origin);
    const direction = readVector3(primitive.direction);
    if (!(origin && direction)) {
      return [];
    }

    return [
      origin,
      origin.clone().add(direction.normalize().multiplyScalar(size)),
    ];
  }, [primitive, size]);

  return (
    <PrimitiveLine
      color={color}
      label={primitive.label}
      points={points}
      showArrow
    />
  );
}

/**
 * Renders an infinite line with a viewport-bounded segment through its point.
 */
function LinePrimitive({
  color,
  primitive,
  size,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitiveView, { kind: "line" }>;
  size: number;
}) {
  const points = useMemo(() => {
    const point = readVector3(primitive.point);
    const direction = readVector3(primitive.direction);
    if (!(point && direction)) {
      return [];
    }

    const scaled = direction.normalize().multiplyScalar(size);
    return [point.clone().sub(scaled), point.clone().add(scaled)];
  }, [primitive, size]);

  return (
    <PrimitiveLine
      color={color}
      label={primitive.label}
      points={points}
      showArrow
    />
  );
}

/**
 * Renders line-like primitives only when exact endpoints are available.
 */
function PrimitiveLine({
  color,
  label,
  points,
  showArrow = false,
}: {
  color: string;
  label?: string;
  points: readonly Vector3[];
  showArrow?: boolean;
}) {
  return points.length === 2 ? (
    <LineEquation
      color={color}
      cone={showArrow ? { position: "both", size: ARROW_SIZE } : undefined}
      labels={
        label ? [{ color, offset: [0, 0.32, 0], text: label }] : undefined
      }
      lineWidth={LINE_WIDTH}
      points={points.map((point) => ({
        x: point.x,
        y: point.y,
        z: point.z,
      }))}
      showPoints={false}
      smooth={false}
    />
  ) : null;
}
