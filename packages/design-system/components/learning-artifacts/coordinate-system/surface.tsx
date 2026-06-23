"use client";

import type { CoordinatePrimitive } from "@repo/math/schema/coordinate/primitive";
import { useMemo } from "react";
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Quaternion,
  Vector3,
} from "three";
import { readVector3 } from "./model/numeric";

/**
 * Renders exact plane and polygon surface primitives from validated geometry.
 */
export function SurfacePrimitive({
  color,
  primitive,
  size,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitive, { kind: "plane" | "polygon" }>;
  size: number;
}) {
  return primitive.kind === "plane" ? (
    <PlanePrimitive color={color} primitive={primitive} size={size} />
  ) : (
    <PolygonPrimitive color={color} primitive={primitive} />
  );
}

/**
 * Renders a finite plane patch from the single validated point-normal truth.
 */
function PlanePrimitive({
  color,
  primitive,
  size,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitive, { kind: "plane" }>;
  size: number;
}) {
  const transform = useMemo(() => {
    const point = readVector3(primitive.point);
    const normal = readVector3(primitive.normal);
    if (!(point && normal)) {
      return;
    }

    return {
      point,
      quaternion: new Quaternion().setFromUnitVectors(
        new Vector3(0, 0, 1),
        normal.normalize()
      ),
    };
  }, [primitive]);

  if (!transform) {
    return null;
  }

  return (
    <mesh position={transform.point} quaternion={transform.quaternion}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color={color}
        opacity={0.18}
        side={DoubleSide}
        transparent
      />
    </mesh>
  );
}

/**
 * Renders a validated coplanar polygon with deterministic fan triangulation.
 */
function PolygonPrimitive({
  color,
  primitive,
}: {
  color: string;
  primitive: Extract<CoordinatePrimitive, { kind: "polygon" }>;
}) {
  const geometry = useMemo(() => readPolygonGeometry(primitive), [primitive]);
  if (!geometry) {
    return null;
  }

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} opacity={0.28} side={DoubleSide} />
    </mesh>
  );
}

/**
 * Builds a Three.js polygon geometry from validated exact vertices.
 */
function readPolygonGeometry(
  primitive: Extract<CoordinatePrimitive, { kind: "polygon" }>
) {
  const vertices = primitive.vertices.map(readVector3);
  if (vertices.some((vertex) => vertex === undefined)) {
    return;
  }

  const positions: number[] = [];
  const indices: number[] = [];
  for (const vertex of vertices) {
    if (!vertex) {
      return;
    }
    positions.push(vertex.x, vertex.y, vertex.z);
  }

  for (let index = 1; index < vertices.length - 1; index += 1) {
    indices.push(0, index, index + 1);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
