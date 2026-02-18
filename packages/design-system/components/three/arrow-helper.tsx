"use client";

import { Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { COLORS } from "@repo/design-system/lib/color";
import { useMemo, useRef } from "react";
import {
  Color,
  ConeGeometry,
  type Group,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

const ARROW_SEGMENTS = 16;
const ARROW_SEGMENT_OFFSET = 0.2;

// Shared geometry and material caches
const coneGeometryCache = new Map<string, ConeGeometry>();
const materialCache = new Map<string, MeshBasicMaterial>();

function getSharedConeGeometry(size: number): ConeGeometry {
  const key = `cone-${size}`;
  if (!coneGeometryCache.has(key)) {
    // Reduced segments from 32 to 16 for better performance
    coneGeometryCache.set(
      key,
      new ConeGeometry(size / 2, size, ARROW_SEGMENTS, 1)
    );
  }
  const geometry = coneGeometryCache.get(key);
  if (!geometry) {
    throw new Error(`Cone geometry not found for size: ${size}`);
  }
  return geometry;
}

function getSharedMaterial(color: string | Color): MeshBasicMaterial {
  const colorKey = color instanceof Color ? color.getHexString() : color;
  if (!materialCache.has(colorKey)) {
    materialCache.set(
      colorKey,
      new MeshBasicMaterial({
        color: color instanceof Color ? color : new Color(color),
      })
    );
  }
  const material = materialCache.get(colorKey);
  if (!material) {
    throw new Error(`Material not found for color: ${colorKey}`);
  }
  return material;
}

interface Props {
  /** Size of the arrowhead */
  arrowSize?: number;
  /** Color of the vector */
  color?: string | Color;
  /** Starting point of the vector [x, y, z] */
  from?: [number, number, number];
  /** Label for the vector */
  label?: string;
  /** Position of the label */
  labelPosition?: "start" | "middle" | "end";
  /** Width of the vector line */
  lineWidth?: number;
  /** Show arrowhead */
  showArrow?: boolean;
  /** End point of the vector [x, y, z] */
  to: [number, number, number];
  /** Use mono font for the label */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
}

export function ArrowHelper({
  from = [0, 0, 0],
  to,
  color = COLORS.YELLOW,
  lineWidth = 2,
  showArrow = true,
  arrowSize = 0.5,
  label,
  labelPosition = "end",
  useMonoFont = true,
  ...props
}: Props) {
  const groupRef = useRef<Group>(null);

  // Memoize vector calculations
  const vectors = useMemo(() => {
    const fromVec = new Vector3(...from);
    const toVec = new Vector3(...to);
    const direction = new Vector3().subVectors(toVec, fromVec).normalize();
    const length = fromVec.distanceTo(toVec);
    return { fromVec, toVec, direction, length };
  }, [from, to]);

  // Memoize label position calculation
  const labelPos = useMemo(() => {
    const midPoint = new Vector3().addVectors(
      vectors.fromVec,
      new Vector3().copy(vectors.direction).multiplyScalar(vectors.length / 2)
    );
    const endPoint = new Vector3().copy(vectors.toVec);

    switch (labelPosition) {
      case "start":
        return vectors.fromVec.clone();
      case "middle":
        return midPoint;
      default:
        // Add slight offset for end position
        return endPoint
          .clone()
          .add(
            new Vector3(
              ARROW_SEGMENT_OFFSET,
              ARROW_SEGMENT_OFFSET,
              ARROW_SEGMENT_OFFSET
            )
          );
    }
  }, [vectors, labelPosition]);

  // Use shared geometry and material
  const coneGeometry = useMemo(
    () => (showArrow ? getSharedConeGeometry(arrowSize) : null),
    [showArrow, arrowSize]
  );

  const material = useMemo(
    () => (showArrow ? getSharedMaterial(color) : null),
    [showArrow, color]
  );

  // Define the shaft points - from the start point to just before the cone
  const shaftPoints = useMemo(
    () => [
      vectors.fromVec,
      new Vector3(
        vectors.toVec.x - vectors.direction.x * arrowSize,
        vectors.toVec.y - vectors.direction.y * arrowSize,
        vectors.toVec.z - vectors.direction.z * arrowSize
      ),
    ],
    [vectors, arrowSize]
  );

  // Memoize cone position and quaternion
  const coneTransform = useMemo(() => {
    if (!showArrow) {
      return null;
    }

    const position = new Vector3(
      vectors.toVec.x - (vectors.direction.x * arrowSize) / 2,
      vectors.toVec.y - (vectors.direction.y * arrowSize) / 2,
      vectors.toVec.z - (vectors.direction.z * arrowSize) / 2
    );

    const quaternion = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      vectors.direction
    );

    return { position, quaternion };
  }, [showArrow, vectors, arrowSize]);

  // Memoize font path
  const fontPath = useMemo(
    () => (useMonoFont ? MONO_FONT_PATH : FONT_PATH),
    [useMonoFont]
  );

  // Enable frustum culling for the entire group
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.frustumCulled = true;
    }
  });

  return (
    <group ref={groupRef} {...props}>
      {/* Shaft of the arrow */}
      <Line
        color={color}
        frustumCulled
        lineWidth={lineWidth}
        points={shaftPoints}
      />

      {/* Cone arrowhead with optimized segments */}
      {!!showArrow && !!coneGeometry && !!material && !!coneTransform && (
        <mesh
          frustumCulled
          geometry={coneGeometry}
          material={material}
          position={coneTransform.position}
          quaternion={coneTransform.quaternion}
        />
      )}

      {/* Label text */}
      <Text
        anchorX="left"
        color={color instanceof Color ? color.getStyle() : color || ""}
        font={fontPath}
        fontSize={0.5}
        frustumCulled
        position={labelPos}
        visible={Boolean(label)}
      >
        {label}
      </Text>
    </group>
  );
}
