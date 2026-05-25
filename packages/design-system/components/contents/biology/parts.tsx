"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { BiologyScenePoint } from "@repo/design-system/components/contents/biology/data";
import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import * as THREE from "three";

const NUCLEIC_ACID_STEP_COUNT = 36;
const NUCLEIC_ACID_BASE_PAIR_COUNT = 12;
const NUCLEIC_ACID_BASE_TICK_COUNT = 9;
const NUCLEIC_ACID_MARKER_COUNT = 8;
const NUCLEIC_ACID_FULL_SEGMENT = [0, 1] as const;
const TAU = Math.PI * 2;

/**
 * Rotates an educational model slowly without hiding the first-read structure.
 */
export function RotatingGroup({
  children,
  speed = 0.18,
}: {
  children: ReactNode;
  speed?: number;
}) {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    ref.current.rotation.y += delta * speed;
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Makes a structure gently expand and contract so active biological material
 * reads as alive without needing state updates.
 */
export function PulsingGroup({
  children,
  phase = 0,
  speed = 1.4,
  strength = 0.06,
}: {
  children: ReactNode;
  phase?: number;
  speed?: number;
  strength?: number;
}) {
  const ref = useRef<Group>(null);
  const timeRef = useRef(phase);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    timeRef.current += delta * speed;

    const scale = 1 + Math.sin(timeRef.current) * strength;

    ref.current.scale.setScalar(scale);
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Moves a nested structure up and down to make spores, droplets, and heat
 * indicators readable as processes instead of frozen icons.
 */
export function FloatingGroup({
  children,
  phase = 0,
  speed = 1,
  travel = 0.08,
}: {
  children: ReactNode;
  phase?: number;
  speed?: number;
  travel?: number;
}) {
  const ref = useRef<Group>(null);
  const timeRef = useRef(phase);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    timeRef.current += delta * speed;
    ref.current.position.y = Math.sin(timeRef.current) * travel;
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Slides a nested structure horizontally on a loop for visible transfer,
 * spread, and circulation diagrams.
 */
export function SlidingGroup({
  children,
  phase = 0,
  speed = 1,
  travel = 0.16,
}: {
  children: ReactNode;
  phase?: number;
  speed?: number;
  travel?: number;
}) {
  const ref = useRef<Group>(null);
  const timeRef = useRef(phase);

  useFrame((_, delta) => {
    if (!ref.current) {
      return;
    }

    timeRef.current += delta * speed;
    ref.current.position.x = Math.sin(timeRef.current) * travel;
  });

  return <group ref={ref}>{children}</group>;
}

/**
 * Renders DNA as two sugar-phosphate backbones with base-pair rungs.
 */
export function DnaDoubleHelix({
  backboneColor,
  lineWidth = 2.4,
  pairColor,
  pairLineWidth = 1.2,
  radius = 0.055,
  segment = NUCLEIC_ACID_FULL_SEGMENT,
  turns = 2.1,
  length = 0.92,
}: {
  backboneColor: string;
  lineWidth?: number;
  pairColor: string;
  pairLineWidth?: number;
  radius?: number;
  segment?: readonly [number, number];
  turns?: number;
  length?: number;
}) {
  const firstStrand = createNucleicAcidBackbonePoints({
    length,
    phase: 0,
    radius,
    segment,
    turns,
  });
  const secondStrand = createNucleicAcidBackbonePoints({
    length,
    phase: Math.PI,
    radius,
    segment,
    turns,
  });
  const basePairs = createNucleicAcidBasePairs({
    length,
    radius,
    segment,
    turns,
  });
  const firstMarkers = createNucleicAcidMarkerPoints({
    length,
    phase: 0,
    radius,
    segment,
    turns,
  });
  const secondMarkers = createNucleicAcidMarkerPoints({
    length,
    phase: Math.PI,
    radius,
    segment,
    turns,
  });
  const markerRadius = Math.max(0.012, lineWidth * 0.005);

  return (
    <group>
      <BiologyLine
        color={backboneColor}
        lineWidth={lineWidth}
        points={firstStrand}
      />
      <BiologyLine
        color={backboneColor}
        lineWidth={lineWidth}
        points={secondStrand}
      />
      {basePairs.map((basePair) => (
        <BiologyLine
          color={pairColor}
          key={basePair.id}
          lineWidth={pairLineWidth}
          points={basePair.points}
        />
      ))}
      <BackboneMarkers
        color={backboneColor}
        points={firstMarkers}
        radius={markerRadius}
      />
      <BackboneMarkers
        color={backboneColor}
        points={secondMarkers}
        radius={markerRadius}
      />
    </group>
  );
}

/**
 * Renders RNA as one flexible backbone with visible bases on one side.
 */
export function RnaSingleStrand({
  backboneColor,
  baseColor,
  lineWidth = 2.4,
  radius = 0.055,
  turns = 1.7,
  length = 0.78,
}: {
  backboneColor: string;
  baseColor: string;
  lineWidth?: number;
  radius?: number;
  turns?: number;
  length?: number;
}) {
  const backbone = createNucleicAcidBackbonePoints({
    length,
    phase: 0,
    radius,
    segment: NUCLEIC_ACID_FULL_SEGMENT,
    turns,
  });
  const baseTicks = createRnaBaseTicks({ length, radius, turns });
  const markers = createNucleicAcidMarkerPoints({
    length,
    phase: 0,
    radius,
    segment: NUCLEIC_ACID_FULL_SEGMENT,
    turns,
  });
  const markerRadius = Math.max(0.012, lineWidth * 0.005);

  return (
    <group>
      <BiologyLine
        color={backboneColor}
        lineWidth={lineWidth}
        points={backbone}
      />
      {baseTicks.map((baseTick) => (
        <BiologyLine
          color={baseColor}
          key={baseTick.id}
          lineWidth={Math.max(1, lineWidth - 1)}
          points={baseTick.points}
        />
      ))}
      <BackboneMarkers
        color={backboneColor}
        points={markers}
        radius={markerRadius}
      />
    </group>
  );
}

/**
 * Renders a theme-aware base plane for scenes that need environmental context.
 */
export function BiologyGround({
  color,
  scale = [3.8, 0.08, 2.4],
}: {
  color: string;
  scale?: BiologyScenePoint;
}) {
  return (
    <mesh
      position={[0, -0.9, 0]}
      receiveShadow
      scale={[scale[0] / 2, scale[1], scale[2] / 2]}
    >
      <cylinderGeometry args={[1, 1, 1, 56]} />
      <meshStandardMaterial
        color={color}
        depthWrite={false}
        opacity={0.26}
        transparent
      />
    </mesh>
  );
}

/**
 * Draws a curved-looking path from stable points without custom geometry.
 */
export function BiologyLine({
  color,
  lineWidth = 2,
  points,
}: {
  color: string;
  lineWidth?: number;
  points: readonly BiologyScenePoint[];
}) {
  return <Line color={color} lineWidth={lineWidth} points={points} />;
}

/**
 * Builds connected organic curves as real geometry when a line would look like
 * an unfinished sketch.
 */
export function BiologyTube({
  color,
  opacity = 1,
  points,
  radius,
  segments = 32,
}: {
  color: string;
  opacity?: number;
  points: readonly BiologyScenePoint[];
  radius: number;
  segments?: number;
}) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point))
      ),
    [points]
  );

  return (
    <mesh>
      <tubeGeometry args={[curve, segments, radius, 8, false]} />
      <meshStandardMaterial
        color={color}
        depthWrite={opacity >= 1}
        opacity={opacity}
        roughness={0.78}
        transparent={opacity < 1}
      />
    </mesh>
  );
}

/**
 * Adds small 3D markers so nucleic acids read as molecular assets, not strokes.
 */
function BackboneMarkers({
  color,
  points,
  radius,
}: {
  color: string;
  points: readonly {
    id: string;
    position: BiologyScenePoint;
  }[];
  radius: number;
}) {
  return points.map((point) => (
    <mesh key={point.id} position={point.position}>
      <sphereGeometry args={[radius, 8, 6]} />
      <meshStandardMaterial color={color} roughness={0.64} />
    </mesh>
  ));
}

/**
 * Samples one point on a right-handed nucleic acid helix.
 */
function createNucleicAcidPoint({
  index,
  length,
  phase,
  radius,
  segment,
  stepCount,
  turns,
}: {
  index: number;
  length: number;
  phase: number;
  radius: number;
  segment: readonly [number, number];
  stepCount: number;
  turns: number;
}) {
  const [start, end] = segment;
  const localProgress = index / (stepCount - 1);
  const progress = start + (end - start) * localProgress;
  const angle = progress * turns * TAU + phase;

  return [
    (progress - 0.5) * length,
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  ] satisfies BiologyScenePoint;
}

/**
 * Creates one sampled sugar-phosphate backbone for DNA or RNA.
 */
function createNucleicAcidBackbonePoints({
  length,
  phase,
  radius,
  segment,
  turns,
}: {
  length: number;
  phase: number;
  radius: number;
  segment: readonly [number, number];
  turns: number;
}) {
  return Array.from({ length: NUCLEIC_ACID_STEP_COUNT }, (_, index) =>
    createNucleicAcidPoint({
      index,
      length,
      phase,
      radius,
      segment,
      stepCount: NUCLEIC_ACID_STEP_COUNT,
      turns,
    })
  );
}

/**
 * Creates sparse backbone marker points for a clearer molecular silhouette.
 */
function createNucleicAcidMarkerPoints({
  length,
  phase,
  radius,
  segment,
  turns,
}: {
  length: number;
  phase: number;
  radius: number;
  segment: readonly [number, number];
  turns: number;
}) {
  const [start, end] = segment;
  const visibleSpan = end - start;
  const markerCount = Math.max(
    2,
    Math.round(NUCLEIC_ACID_MARKER_COUNT * visibleSpan)
  );

  return Array.from({ length: markerCount }, (_, index) => ({
    id: `marker-${phase}-${index}`,
    position: createNucleicAcidPoint({
      index,
      length,
      phase,
      radius,
      segment,
      stepCount: markerCount,
      turns,
    }),
  }));
}

/**
 * Creates short DNA rungs between complementary strands.
 */
function createNucleicAcidBasePairs({
  length,
  radius,
  segment,
  turns,
}: {
  length: number;
  radius: number;
  segment: readonly [number, number];
  turns: number;
}) {
  const [start, end] = segment;
  const visibleSpan = end - start;
  const basePairCount = Math.max(
    3,
    Math.round(NUCLEIC_ACID_BASE_PAIR_COUNT * visibleSpan)
  );

  return Array.from({ length: basePairCount }, (_, index) => {
    const stepCount = basePairCount + 2;
    const pairIndex = index + 1;

    return {
      id: `base-pair-${index}`,
      points: [
        createNucleicAcidPoint({
          index: pairIndex,
          length,
          phase: 0,
          radius,
          segment,
          stepCount,
          turns,
        }),
        createNucleicAcidPoint({
          index: pairIndex,
          length,
          phase: Math.PI,
          radius,
          segment,
          stepCount,
          turns,
        }),
      ],
    };
  });
}

/**
 * Creates short inward bases on an RNA strand without implying a second strand.
 */
function createRnaBaseTicks({
  length,
  radius,
  turns,
}: {
  length: number;
  radius: number;
  turns: number;
}) {
  return Array.from({ length: NUCLEIC_ACID_BASE_TICK_COUNT }, (_, index) => {
    const stepCount = NUCLEIC_ACID_BASE_TICK_COUNT + 2;
    const outerPoint = createNucleicAcidPoint({
      index: index + 1,
      length,
      phase: 0,
      radius,
      segment: NUCLEIC_ACID_FULL_SEGMENT,
      stepCount,
      turns,
    });
    const innerPoint = [
      outerPoint[0],
      outerPoint[1] * 0.32,
      outerPoint[2] * 0.32,
    ] satisfies BiologyScenePoint;

    return {
      id: `rna-base-${index}`,
      points: [outerPoint, innerPoint],
    };
  });
}
