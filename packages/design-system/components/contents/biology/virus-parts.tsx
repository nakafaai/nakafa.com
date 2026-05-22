"use client";

import { Line } from "@react-three/drei";
import {
  BIOLOGY_SMALL_RING_POINT_COUNT,
  type BiologySceneColors,
  type BiologyScenePoint,
  createBiologySpherePoints,
} from "@repo/design-system/components/contents/biology/data";
import { Quaternion, Vector3 } from "three";

const VECTOR_UP = new Vector3(0, 1, 0);
const VIRION_SPIKE_HEADS = [
  [0, 0, 0],
  [0.055, 0.014, 0],
  [-0.028, 0.014, 0.048],
  [-0.028, 0.014, -0.048],
] satisfies readonly BiologyScenePoint[];
const MINI_VIRION_SPIKES = createVirusSurfaceAnchors(
  BIOLOGY_SMALL_RING_POINT_COUNT,
  0.24
);
const PHAGE_FIBERS = [
  [
    [0, -0.42, 0],
    [-0.24, -0.62, 0.16],
  ],
  [
    [0, -0.42, 0],
    [0.24, -0.62, 0.16],
  ],
  [
    [0, -0.42, 0],
    [-0.2, -0.62, -0.16],
  ],
  [
    [0, -0.42, 0],
    [0.2, -0.62, -0.16],
  ],
] satisfies readonly (readonly BiologyScenePoint[])[];

/**
 * Creates radially oriented anchors for envelope spikes.
 */
export function createVirusSurfaceAnchors(count: number, radius: number) {
  return createBiologySpherePoints(count, radius).map((point) => {
    const direction = new Vector3(...point.position).normalize();

    return {
      id: point.id,
      position: [
        direction.x * radius,
        direction.y * radius,
        direction.z * radius,
      ] satisfies BiologyScenePoint,
      quaternion: new Quaternion().setFromUnitVectors(VECTOR_UP, direction),
    };
  });
}

/**
 * Renders one stalked viral surface protein instead of a decorative dot.
 */
export function VirusSurfaceSpike({
  anchor,
  color,
  highlighted = false,
}: {
  anchor: ReturnType<typeof createVirusSurfaceAnchors>[number];
  color: string;
  highlighted?: boolean;
}) {
  const headRadius = highlighted ? 0.058 : 0.046;
  const stalkRadius = highlighted ? 0.026 : 0.02;

  return (
    <group position={anchor.position} quaternion={anchor.quaternion}>
      <mesh position={[0, 0.12, 0]}>
        <capsuleGeometry args={[stalkRadius, 0.22, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>
      <group position={[0, 0.27, 0]}>
        {VIRION_SPIKE_HEADS.map((position) => (
          <mesh key={position.join("-")} position={position}>
            <sphereGeometry args={[headRadius, 12, 10]} />
            <meshStandardMaterial color={color} roughness={0.72} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/**
 * Shows an enveloped virion with protruding proteins at small scale.
 */
export function MiniEnvelopedVirion({
  colors,
  scale = 1,
}: {
  colors: Pick<BiologySceneColors, "genome" | "host" | "microbe" | "pathogen">;
  scale?: number;
}) {
  return (
    <group scale={scale}>
      <mesh>
        <sphereGeometry args={[0.2, 24, 16]} />
        <meshStandardMaterial
          color={colors.host}
          opacity={0.32}
          roughness={0.76}
          transparent
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.13, 1]} />
        <meshStandardMaterial color={colors.pathogen} roughness={0.72} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.075, 0.01, 6, 32]} />
        <meshStandardMaterial color={colors.genome} />
      </mesh>
      {MINI_VIRION_SPIKES.map((anchor) => (
        <VirusSurfaceSpike
          anchor={anchor}
          color={colors.microbe}
          key={anchor.id}
        />
      ))}
    </group>
  );
}

/**
 * Renders a bacteriophage with head, tail sheath, base plate, and fibers.
 */
export function BacteriophageModel({
  colors,
  scale = 1,
}: {
  colors: Pick<BiologySceneColors, "arrow" | "genome" | "pathogen">;
  scale?: number;
}) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.26, 0]}>
        <icosahedronGeometry args={[0.2, 1]} />
        <meshStandardMaterial color={colors.pathogen} roughness={0.66} />
      </mesh>
      <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.085, 0.012, 6, 28]} />
        <meshStandardMaterial color={colors.genome} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.16, 12]} />
        <meshStandardMaterial color={colors.arrow} roughness={0.74} />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.052, 0.34, 6, 12]} />
        <meshStandardMaterial color={colors.pathogen} roughness={0.72} />
      </mesh>
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[0.13, 0.1, 0.05, 16]} />
        <meshStandardMaterial color={colors.arrow} roughness={0.72} />
      </mesh>
      {PHAGE_FIBERS.map((points) => (
        <Line
          color={colors.arrow}
          key={points.map((point) => point.join("-")).join("|")}
          lineWidth={2}
          points={points}
        />
      ))}
    </group>
  );
}
