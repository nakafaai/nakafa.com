"use client";

import {
  BIOLOGY_SMALL_RING_POINT_COUNT,
  type BiologySceneColors,
  type BiologyScenePoint,
  createBiologySpherePoints,
} from "@repo/design-system/components/contents/biology/data";
import {
  DnaDoubleHelix,
  RnaSingleStrand,
} from "@repo/design-system/components/contents/biology/parts";
import { useMemo } from "react";
import { CatmullRomCurve3, Quaternion, Vector3 } from "three";

const VECTOR_UP = new Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const HELICAL_CAPSOMERE_COUNT = 64;
const HELICAL_RIDGE_SAMPLE_COUNT = 72;
const HELICAL_TURN_COUNT = 5.1;
const HELICAL_CAPSID_LENGTH = 0.98;
const HELICAL_CAPSID_RADIUS = 0.16;
const ADENOVIRUS_CAPSOMERS = createVirusSurfaceAnchors(26, 0.34);
const ADENOVIRUS_VERTEX_FIBERS = createVirusSurfaceAnchors(8, 0.39);
const INFLUENZA_SPIKES = createVirusSurfaceAnchors(18, 0.42);
const INFLUENZA_RIBONUCLEOPROTEINS = [
  { id: "rna-1", position: [-0.11, 0, 0], rotation: [0.2, 0.8, -0.08] },
  { id: "rna-2", position: [0.04, 0.02, 0.03], rotation: [-0.1, 0.2, 0.12] },
  { id: "rna-3", position: [0.15, -0.02, -0.02], rotation: [0.3, -0.45, 0.05] },
] as const;
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
const HELICAL_CAPSOMERES = createHelicalCapsomeres();
const HELICAL_RIDGE_POINTS = [
  { id: "front-ridge", points: createHelicalRidgePoints(0) },
  { id: "back-ridge", points: createHelicalRidgePoints(Math.PI) },
] as const;

/**
 * Shows a helical virus like tobacco mosaic virus, where capsomeres spiral
 * around a central RNA strand instead of forming a faceted shell.
 */
export function HelicalVirusModel({
  colors,
  scale = 1,
}: {
  colors: Pick<BiologySceneColors, "genome" | "membrane" | "pathogen">;
  scale?: number;
}) {
  return (
    <group scale={scale}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[
            HELICAL_CAPSID_RADIUS * 0.88,
            HELICAL_CAPSID_RADIUS * 0.88,
            HELICAL_CAPSID_LENGTH,
            42,
          ]}
        />
        <meshStandardMaterial
          color={colors.membrane}
          opacity={0.22}
          roughness={0.8}
          transparent
        />
      </mesh>
      <group scale={0.86}>
        <RnaSingleStrand
          backboneColor={colors.genome}
          baseColor={colors.pathogen}
          length={HELICAL_CAPSID_LENGTH * 0.8}
          lineWidth={1.5}
          radius={0.026}
          turns={HELICAL_TURN_COUNT * 0.78}
        />
      </group>
      {HELICAL_RIDGE_POINTS.map((ridge) => (
        <VirusTube
          color={colors.pathogen}
          key={ridge.id}
          opacity={0.72}
          points={ridge.points}
          radius={0.009}
        />
      ))}
      {HELICAL_CAPSOMERES.map((capsomere) => (
        <group
          key={capsomere.id}
          position={capsomere.position}
          quaternion={capsomere.quaternion}
        >
          <mesh position={[0, 0.012, 0]} scale={[0.92, 1, 0.82]}>
            <capsuleGeometry args={[0.026, 0.052, 4, 10]} />
            <meshStandardMaterial color={colors.membrane} roughness={0.68} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Shows a polyhedral virus like adenovirus with a faceted capsid and vertex
 * fibers, without implying an outer lipid envelope.
 */
export function PolyhedralVirusModel({
  colors,
  scale = 1,
}: {
  colors: Pick<
    BiologySceneColors,
    "genome" | "membrane" | "microbe" | "pathogen"
  >;
  scale?: number;
}) {
  return (
    <group scale={scale}>
      <mesh>
        <icosahedronGeometry args={[0.35, 1]} />
        <meshStandardMaterial color={colors.membrane} roughness={0.7} />
      </mesh>
      <group rotation={[0.3, 0.18, -0.2]} scale={0.34}>
        <DnaDoubleHelix
          backboneColor={colors.genome}
          pairColor={colors.pathogen}
          pairLineWidth={0.7}
          radius={0.045}
          turns={1.2}
        />
      </group>
      {ADENOVIRUS_CAPSOMERS.map((anchor) => (
        <mesh key={anchor.id} position={anchor.position}>
          <sphereGeometry args={[0.031, 10, 8]} />
          <meshStandardMaterial color={colors.pathogen} roughness={0.7} />
        </mesh>
      ))}
      {ADENOVIRUS_VERTEX_FIBERS.map((anchor) => (
        <group
          key={anchor.id}
          position={anchor.position}
          quaternion={anchor.quaternion}
        >
          <mesh position={[0, 0.1, 0]}>
            <capsuleGeometry args={[0.012, 0.13, 5, 8]} />
            <meshStandardMaterial color={colors.microbe} roughness={0.74} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial color={colors.microbe} roughness={0.74} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Shows an enveloped spherical virus like influenza with a lipid envelope,
 * surface proteins, and several RNA-protein segments inside.
 */
export function EnvelopedVirusModel({
  colors,
  scale = 1,
}: {
  colors: Pick<
    BiologySceneColors,
    "genome" | "host" | "microbe" | "pathogen" | "spore"
  >;
  scale?: number;
}) {
  return (
    <group scale={scale}>
      <mesh>
        <sphereGeometry args={[0.42, 36, 24]} />
        <meshStandardMaterial
          color={colors.host}
          opacity={0.42}
          roughness={0.82}
          transparent
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.3, 28, 18]} />
        <meshStandardMaterial
          color={colors.pathogen}
          opacity={0.22}
          roughness={0.74}
          transparent
        />
      </mesh>
      {INFLUENZA_RIBONUCLEOPROTEINS.map((strand) => (
        <group
          key={strand.id}
          position={strand.position}
          rotation={strand.rotation}
          scale={0.42}
        >
          <RnaSingleStrand
            backboneColor={colors.genome}
            baseColor={colors.spore}
            lineWidth={1.8}
            radius={0.04}
            turns={1.8}
          />
        </group>
      ))}
      {INFLUENZA_SPIKES.map((anchor) => (
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
      <group rotation={[0.2, 0.1, -0.4]} scale={0.38}>
        <RnaSingleStrand
          backboneColor={colors.genome}
          baseColor={colors.microbe}
          lineWidth={2}
          radius={0.04}
          turns={1.4}
        />
      </group>
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
      <group position={[0, 0.26, 0]} rotation={[0.18, 0, -0.42]} scale={0.38}>
        <DnaDoubleHelix
          backboneColor={colors.genome}
          pairColor={colors.arrow}
          pairLineWidth={0.8}
          radius={0.045}
          turns={1.15}
        />
      </group>
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
        <VirusTube
          color={colors.arrow}
          key={points.map((point) => point.join("-")).join("|")}
          points={points}
          radius={0.01}
        />
      ))}
    </group>
  );
}

/**
 * Samples capsomere positions around a helical capsid.
 */
function createHelicalCapsomeres() {
  return Array.from({ length: HELICAL_CAPSOMERE_COUNT }, (_, index) => {
    const progress = index / (HELICAL_CAPSOMERE_COUNT - 1);
    const angle = progress * HELICAL_TURN_COUNT * TAU;
    const x = (progress - 0.5) * HELICAL_CAPSID_LENGTH;
    const direction = new Vector3(0, Math.cos(angle), Math.sin(angle));

    return {
      id: `helical-capsomere-${index}`,
      position: [
        x,
        direction.y * HELICAL_CAPSID_RADIUS,
        direction.z * HELICAL_CAPSID_RADIUS,
      ] satisfies BiologyScenePoint,
      quaternion: new Quaternion().setFromUnitVectors(VECTOR_UP, direction),
    };
  });
}

/**
 * Samples visible helical grooves around the rod so the capsid reads as a
 * tobacco-mosaic-like helix instead of scattered beads.
 */
function createHelicalRidgePoints(phase: number) {
  return Array.from({ length: HELICAL_RIDGE_SAMPLE_COUNT }, (_, index) => {
    const progress = index / (HELICAL_RIDGE_SAMPLE_COUNT - 1);
    const angle = progress * HELICAL_TURN_COUNT * TAU + phase;

    return [
      (progress - 0.5) * HELICAL_CAPSID_LENGTH,
      Math.cos(angle) * HELICAL_CAPSID_RADIUS * 1.02,
      Math.sin(angle) * HELICAL_CAPSID_RADIUS * 1.02,
    ] satisfies BiologyScenePoint;
  });
}

/**
 * Renders a smooth 3D tube for narrow biological fibers.
 */
export function VirusTube({
  color,
  opacity = 1,
  points,
  radius,
}: {
  color: string;
  opacity?: number;
  points: readonly (readonly [number, number, number])[];
  radius: number;
}) {
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map((point) => new Vector3(...point))),
    [points]
  );

  return (
    <mesh>
      <tubeGeometry args={[curve, 24, radius, 8, false]} />
      <meshStandardMaterial
        color={color}
        opacity={opacity}
        roughness={0.76}
        transparent={opacity < 1}
      />
    </mesh>
  );
}
