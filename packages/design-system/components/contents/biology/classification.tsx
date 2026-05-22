"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyGridPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyGround,
  BiologyLine,
  FloatingGroup,
  PulsingGroup,
  RotatingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";

const KINGDOM_POINTS = createBiologyGridPoints(1, 5);
const PHYLOGENY_TRUNK = [
  [0, -0.9, 0],
  [0, -0.35, 0],
  [0, 0.15, 0],
] as const;
const PHYLOGENY_LEFT = [
  [0, -0.1, 0],
  [-0.72, 0.42, 0],
  [-1.15, 0.82, 0],
] as const;
const PHYLOGENY_MIDDLE = [
  [0, 0.05, 0],
  [0.05, 0.55, 0],
  [0.05, 0.95, 0],
] as const;
const PHYLOGENY_RIGHT = [
  [0, -0.02, 0],
  [0.78, 0.48, 0],
  [1.22, 0.86, 0],
] as const;

/**
 * Renders artificial, natural, and phylogenetic classification views.
 */
export function ClassificationLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={ClassificationScene} {...props} />;
}

/**
 * Separates surface grouping from relationship-based grouping.
 */
function ClassificationScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <NaturalClassification colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <PhylogeneticClassification colors={colors} />;
  }

  return <ArtificialClassification colors={colors} />;
}

/**
 * Shows artificial grouping by visible traits.
 */
function ArtificialClassification({
  colors,
}: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <BiologyGround color={colors.soil} scale={[3.2, 0.08, 1.5]} />
      {[-0.95, 0, 0.95].map((x, index) => (
        <group key={x} position={[x, -0.18, 0.18]}>
          <mesh scale={[0.42, 0.36, 0.22]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={colors.muted}
              opacity={0.24}
              transparent
            />
          </mesh>
          <FloatingGroup phase={index * 0.8} travel={0.045}>
            <ArtificialSpecimen colors={colors} index={index} />
          </FloatingGroup>
        </group>
      ))}
    </group>
  );
}

/**
 * Shows kingdom-level grouping as parallel biological patterns.
 */
function NaturalClassification({ colors }: Pick<BiologySceneProps, "colors">) {
  const kingdomColors = [
    colors.microbe,
    colors.ocean,
    colors.decomposer,
    colors.plant,
    colors.animal,
  ];

  return (
    <group>
      {KINGDOM_POINTS.map((point, index) => (
        <PulsingGroup key={point.id} phase={index * 0.35} strength={0.035}>
          <group position={[point.position[0] * 0.52, -0.1, 0]}>
            <mesh
              position={[0, 0.28, 0]}
              scale={[0.18, 0.56 + index * 0.05, 0.18]}
            >
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial
                color={kingdomColors[index]}
                opacity={0.78}
                transparent
              />
            </mesh>
            <SceneLabel
              color={colors.text}
              fontSize="compact"
              position={[0, -0.42, 0]}
            >
              {String(index + 1)}
            </SceneLabel>
          </group>
        </PulsingGroup>
      ))}
    </group>
  );
}

/**
 * Shows phylogenetic classification as branching ancestry.
 */
function PhylogeneticClassification({
  colors,
}: Pick<BiologySceneProps, "colors">) {
  const nodeColors = [colors.plant, colors.decomposer, colors.animal];

  return (
    <group>
      <PulsingGroup speed={0.75} strength={0.02}>
        <BiologyLine
          color={colors.arrow}
          lineWidth={4}
          points={PHYLOGENY_TRUNK}
        />
        <BiologyLine
          color={colors.plant}
          lineWidth={3}
          points={PHYLOGENY_LEFT}
        />
        <BiologyLine
          color={colors.decomposer}
          lineWidth={3}
          points={PHYLOGENY_MIDDLE}
        />
        <BiologyLine
          color={colors.animal}
          lineWidth={3}
          points={PHYLOGENY_RIGHT}
        />
      </PulsingGroup>
      <RotatingGroup speed={0.1}>
        {[-1.15, 0.05, 1.22].map((x, index) => (
          <mesh key={x} position={[x, index === 1 ? 0.95 : 0.86, 0.12]}>
            <sphereGeometry args={[0.16, 18, 14]} />
            <meshStandardMaterial color={nodeColors[index]} />
          </mesh>
        ))}
      </RotatingGroup>
    </group>
  );
}

/**
 * Renders one artificial classification specimen by visible form.
 */
function ArtificialSpecimen({
  colors,
  index,
}: Pick<BiologySceneProps, "colors"> & { index: number }) {
  const specimenColors = [colors.plant, colors.animal, colors.microbe];

  if (index === 0) {
    return (
      <mesh position={[0, 0.18, 0.18]}>
        <coneGeometry args={[0.16, 0.42, 12]} />
        <meshStandardMaterial color={specimenColors[index]} />
      </mesh>
    );
  }

  if (index === 1) {
    return (
      <mesh position={[0, 0.18, 0.18]}>
        <sphereGeometry args={[0.18, 18, 14]} />
        <meshStandardMaterial color={specimenColors[index]} />
      </mesh>
    );
  }

  return (
    <mesh position={[0, 0.18, 0.18]}>
      <capsuleGeometry args={[0.1, 0.34, 6, 14]} />
      <meshStandardMaterial color={specimenColors[index]} />
    </mesh>
  );
}
