"use client";

import { COLORS } from "@/lib/utils/color";
import { Line, Text } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

type Props = {
  /** Starting point of the vector [x, y, z] */
  from?: [number, number, number];
  /** End point of the vector [x, y, z] */
  to: [number, number, number];
  /** Color of the vector */
  color?: string | THREE.Color;
  /** Width of the vector line */
  lineWidth?: number;
  /** Show arrowhead */
  showArrow?: boolean;
  /** Size of the arrowhead */
  arrowSize?: number;
  /** Label for the vector */
  label?: string;
  /** Position of the label */
  labelPosition?: "start" | "middle" | "end";
  /** Use mono font for the label */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
};

export function ArrowHelper({
  from = [0, 0, 0],
  to,
  color = COLORS.YELLOW,
  arrowSize = 0.5,
  label,
  labelPosition = "end",
  font = "mono",
}: Props) {
  const vectors = useMemo(() => {
    const fromVec = new THREE.Vector3(...from);
    const toVec = new THREE.Vector3(...to);
    const direction = new THREE.Vector3()
      .subVectors(toVec, fromVec)
      .normalize();
    const length = fromVec.distanceTo(toVec);
    return { fromVec, toVec, direction, length };
  }, [from, to]);

  const midPoint = new THREE.Vector3().addVectors(
    vectors.fromVec,
    new THREE.Vector3()
      .copy(vectors.direction)
      .multiplyScalar(vectors.length / 2)
  );

  const endPoint = new THREE.Vector3().copy(vectors.toVec);

  let labelPos: THREE.Vector3;
  if (labelPosition === "start") {
    labelPos = new THREE.Vector3().copy(vectors.fromVec);
  } else if (labelPosition === "middle") {
    labelPos = midPoint;
  } else {
    // Default to "end"
    labelPos = new THREE.Vector3()
      .copy(endPoint)
      .add(new THREE.Vector3(0.2, 0.2, 0.2));
  }

  // Use a higher segment count for smoother cone
  const coneGeometry = useMemo(
    () => new THREE.ConeGeometry(arrowSize / 2, arrowSize, 32, 1),
    [arrowSize]
  );

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: color instanceof THREE.Color ? color : new THREE.Color(color),
      }),
    [color]
  );

  // Define the shaft points - from the start point to just before the cone
  const points = useMemo(
    () => [
      new THREE.Vector3(...from),
      new THREE.Vector3(
        vectors.toVec.x - vectors.direction.x * arrowSize,
        vectors.toVec.y - vectors.direction.y * arrowSize,
        vectors.toVec.z - vectors.direction.z * arrowSize
      ),
    ],
    [from, vectors.toVec, vectors.direction, arrowSize]
  );

  const fontToUse = font === "mono" ? MONO_FONT_PATH : FONT_PATH;

  return (
    <group>
      {/* Shaft of the arrow */}
      <Line points={points} color={color} lineWidth={2} />

      {/* Cone arrowhead with smooth segments */}
      <mesh
        geometry={coneGeometry}
        material={material}
        position={[
          vectors.toVec.x - (vectors.direction.x * arrowSize) / 2,
          vectors.toVec.y - (vectors.direction.y * arrowSize) / 2,
          vectors.toVec.z - (vectors.direction.z * arrowSize) / 2,
        ]}
        quaternion={new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          vectors.direction
        )}
      />

      <Text
        visible={!!label}
        position={[labelPos.x, labelPos.y, labelPos.z]}
        color={color instanceof THREE.Color ? color.getStyle() : color}
        fontSize={0.5}
        anchorX="left"
        font={fontToUse}
      >
        {label}
      </Text>
    </group>
  );
}
