"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyGridPoints,
  createBiologyRingPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyGround,
  BiologyLine,
  FloatingGroup,
  PulsingGroup,
  RotatingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";

const GENE_VARIANTS = createBiologyGridPoints(2, 5);
const SPECIES_RING = createBiologyRingPoints(9, 1.05);
const STREAM_PATH = [
  [-1.45, -0.78, 0.18],
  [-0.55, -0.65, 0.34],
  [0.15, -0.82, 0.18],
  [1.35, -0.64, 0.28],
] as const;

/**
 * Renders biodiversity as genetic, species, and ecosystem-scale scenes.
 */
export function BiodiversityLevelsLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={BiodiversityLevelsScene} {...props} />;
}

/**
 * Switches scale instead of reusing one generic biodiversity diagram.
 */
function BiodiversityLevelsScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <SpeciesLevel colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <EcosystemLevel colors={colors} />;
  }

  return <GeneLevel colors={colors} />;
}

/**
 * Shows variation inside one population through different gene beads.
 */
function GeneLevel({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      {GENE_VARIANTS.map((point, index) => (
        <FloatingGroup key={point.id} phase={index * 0.4} travel={0.045}>
          <mesh
            position={[point.position[0] * 0.32, point.position[1] * 0.34, 0]}
          >
            <sphereGeometry args={[index % 2 === 0 ? 0.14 : 0.1, 20, 16]} />
            <meshStandardMaterial
              color={index % 3 === 0 ? colors.genome : colors.plant}
            />
          </mesh>
        </FloatingGroup>
      ))}
      <PulsingGroup speed={1.45} strength={0.05}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusKnotGeometry args={[0.68, 0.026, 96, 6]} />
          <meshStandardMaterial color={colors.genome} />
        </mesh>
      </PulsingGroup>
    </group>
  );
}

/**
 * Shows several species sharing one community space.
 */
function SpeciesLevel({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <RotatingGroup speed={0.12}>
        {SPECIES_RING.map((point, index) => (
          <SpeciesMarker
            colors={colors}
            index={index}
            key={point.id}
            position={[point.position[0], point.position[2] * 0.42, 0.18]}
          />
        ))}
      </RotatingGroup>
      <BiologyGround color={colors.soil} scale={[2.8, 0.08, 1.6]} />
    </group>
  );
}

/**
 * Renders one species marker with a repeated but readable organism form.
 */
function SpeciesMarker({
  colors,
  index,
  position,
}: Pick<BiologySceneProps, "colors"> & {
  index: number;
  position: [number, number, number];
}) {
  const variant = index % 3;

  if (variant === 0) {
    return (
      <mesh position={position}>
        <coneGeometry args={[0.15, 0.38, 12]} />
        <meshStandardMaterial color={colors.plant} />
      </mesh>
    );
  }

  if (variant === 1) {
    return (
      <mesh position={position}>
        <sphereGeometry args={[0.17, 18, 14]} />
        <meshStandardMaterial color={colors.animal} />
      </mesh>
    );
  }

  return (
    <mesh position={position}>
      <boxGeometry args={[0.26, 0.2, 0.2]} />
      <meshStandardMaterial color={colors.microbe} />
    </mesh>
  );
}

/**
 * Shows habitat variety with land, stream, and plant structures.
 */
function EcosystemLevel({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      <SlidingGroup speed={0.75} travel={0.06}>
        <BiologyLine color={colors.ocean} lineWidth={5} points={STREAM_PATH} />
      </SlidingGroup>
      {[-1.1, -0.45, 0.45, 1.1].map((x) => (
        <group key={x} position={[x, -0.45 + Math.abs(x) * 0.12, 0.22]}>
          <mesh position={[0, 0.24, 0]}>
            <coneGeometry args={[0.18, 0.55, 12]} />
            <meshStandardMaterial color={colors.plant} />
          </mesh>
          <mesh position={[0, -0.08, 0]} scale={[0.08, 0.28, 0.08]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={colors.decomposer} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.95, -0.18, 0.36]}>
        <sphereGeometry args={[0.22, 20, 16]} />
        <meshStandardMaterial color={colors.animal} />
      </mesh>
    </group>
  );
}
