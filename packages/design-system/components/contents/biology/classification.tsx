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
  BiologySceneTitle,
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
function ClassificationScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <NaturalClassification colors={colors} label={item.label} />;
  }

  if (selectedIndex === 2) {
    return <PhylogeneticClassification colors={colors} label={item.label} />;
  }

  return <ArtificialClassification colors={colors} label={item.label} />;
}

/**
 * Shows artificial grouping by visible traits.
 */
function ArtificialClassification({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
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
          <ArtificialSpecimen colors={colors} index={index} />
        </group>
      ))}
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows kingdom-level grouping as parallel biological patterns.
 */
function NaturalClassification({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
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
        <group key={point.id} position={[point.position[0] * 0.52, -0.1, 0]}>
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
      ))}
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows phylogenetic classification as branching ancestry.
 */
function PhylogeneticClassification({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  const nodeColors = [colors.plant, colors.decomposer, colors.animal];

  return (
    <group>
      <BiologyLine
        color={colors.arrow}
        lineWidth={4}
        points={PHYLOGENY_TRUNK}
      />
      <BiologyLine color={colors.plant} lineWidth={3} points={PHYLOGENY_LEFT} />
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
      {[-1.15, 0.05, 1.22].map((x, index) => (
        <mesh key={x} position={[x, index === 1 ? 0.95 : 0.86, 0.12]}>
          <sphereGeometry args={[0.16, 18, 14]} />
          <meshStandardMaterial color={nodeColors[index]} />
        </mesh>
      ))}
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
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
