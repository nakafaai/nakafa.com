"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyRingPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyGround,
  BiologySceneTitle,
} from "@repo/design-system/components/contents/biology/parts";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";

const DECOMPOSER_RING = createBiologyRingPoints(8, 0.54);

/**
 * Renders ecosystem organism roles through food flow, energy, and interaction views.
 */
export function EcosystemOrganismsLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={EcosystemOrganismsScene} {...props} />;
}

/**
 * Keeps ecosystem learning tied to relationships, not isolated organism icons.
 */
function EcosystemOrganismsScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <EnergyPyramid colors={colors} label={item.label} />;
  }

  if (selectedIndex === 2) {
    return <NicheInteractions colors={colors} label={item.label} />;
  }

  return <FoodWeb colors={colors} label={item.label} />;
}

/**
 * Shows a producer-to-consumer food chain with decomposers returning matter.
 */
function FoodWeb({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      <Organism color={colors.plant} shape="plant" x={-1.18} />
      <Organism color={colors.animal} shape="grazer" x={0} />
      <Organism color={colors.warning} shape="predator" x={1.18} />
      <ArrowHelper
        color={colors.arrow}
        from={[-0.86, -0.2, 0.2]}
        to={[-0.28, -0.2, 0.2]}
      />
      <ArrowHelper
        color={colors.arrow}
        from={[0.34, -0.2, 0.2]}
        to={[0.92, -0.2, 0.2]}
      />
      {DECOMPOSER_RING.map((point) => (
        <mesh
          key={point.id}
          position={[point.position[0] * 0.5, -0.76, point.position[2] * 0.18]}
        >
          <sphereGeometry args={[0.04, 10, 8]} />
          <meshStandardMaterial color={colors.decomposer} />
        </mesh>
      ))}
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows decreasing energy across trophic levels.
 */
function EnergyPyramid({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <PyramidTier
        color={colors.plant}
        label="1"
        textColor={colors.text}
        width={2.45}
        y={-0.62}
      />
      <PyramidTier
        color={colors.animal}
        label="2"
        textColor={colors.text}
        width={1.55}
        y={-0.22}
      />
      <PyramidTier
        color={colors.warning}
        label="3"
        textColor={colors.text}
        width={0.78}
        y={0.18}
      />
      <ArrowHelper
        color={colors.heat}
        from={[1.45, -0.5, 0.2]}
        to={[1.45, 0.52, 0.2]}
      />
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows mutualism, predation, and decomposition in one habitat.
 */
function NicheInteractions({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <BiologyGround color={colors.soil} />
      <Organism color={colors.plant} shape="plant" x={-0.95} />
      <mesh position={[-0.45, 0.08, 0.28]}>
        <sphereGeometry args={[0.11, 14, 10]} />
        <meshStandardMaterial color={colors.animal} />
      </mesh>
      <ArrowHelper
        color={colors.arrow}
        from={[-0.55, 0.1, 0.22]}
        to={[-0.82, 0.05, 0.22]}
      />
      <Organism color={colors.warning} shape="predator" x={0.52} />
      <mesh position={[1.1, -0.5, 0.18]} rotation={[0, 0, 0.22]}>
        <boxGeometry args={[0.52, 0.16, 0.16]} />
        <meshStandardMaterial color={colors.muted} />
      </mesh>
      <ArrowHelper
        color={colors.decomposer}
        from={[0.86, -0.45, 0.2]}
        to={[0.28, -0.38, 0.2]}
      />
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Renders a simple ecosystem organism marker.
 */
function Organism({
  color,
  shape,
  x,
}: {
  color: string;
  shape: "grazer" | "plant" | "predator";
  x: number;
}) {
  if (shape === "plant") {
    return (
      <group position={[x, -0.42, 0.22]}>
        <mesh position={[0, 0.32, 0]}>
          <coneGeometry args={[0.22, 0.68, 12]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh scale={[0.08, 0.38, 0.08]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh
      position={[x, -0.22, 0.25]}
      scale={shape === "predator" ? [1.15, 0.72, 0.72] : [0.82, 0.62, 0.62]}
    >
      <sphereGeometry args={[0.26, 20, 14]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/**
 * Renders one level of an energy pyramid.
 */
function PyramidTier({
  color,
  label,
  textColor,
  width,
  y,
}: {
  color: string;
  label: string;
  textColor: string;
  width: number;
  y: number;
}) {
  return (
    <group position={[0, y, 0]}>
      <mesh scale={[width, 0.32, 0.42]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} opacity={0.78} transparent />
      </mesh>
      <SceneLabel color={textColor} fontSize="compact" position={[0, 0, 0.25]}>
        {label}
      </SceneLabel>
    </group>
  );
}
