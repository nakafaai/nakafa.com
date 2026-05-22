"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyGridPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  BiologySceneTitle,
} from "@repo/design-system/components/contents/biology/parts";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";

const RIBOSOME_POINTS = createBiologyGridPoints(3, 4);
const SPIRAL_PATH = [
  [-1.1, -0.22, 0],
  [-0.68, 0.24, 0],
  [-0.22, -0.18, 0],
  [0.26, 0.2, 0],
  [0.72, -0.16, 0],
  [1.12, 0.22, 0],
] as const;

/**
 * Renders bacterial shape, structure, and cell-wall comparison views.
 */
export function BacteriaStructureLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={BacteriaStructureScene} {...props} />;
}

/**
 * Uses distinct scenes for morphology, inner anatomy, and Gram wall logic.
 */
function BacteriaStructureScene({
  colors,
  item,
  selectedIndex,
}: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <BacterialStructure colors={colors} label={item.label} />;
  }

  if (selectedIndex === 2) {
    return <GramWallComparison colors={colors} label={item.label} />;
  }

  return <BacterialShapes colors={colors} label={item.label} />;
}

/**
 * Shows coccus, bacillus, and spiral bacterial forms together.
 */
function BacterialShapes({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      {[-1.25, -0.95, -0.65].map((x) => (
        <mesh key={x} position={[x, 0.05, 0]}>
          <sphereGeometry args={[0.16, 18, 14]} />
          <meshStandardMaterial color={colors.microbe} />
        </mesh>
      ))}
      {[0.08, 0.45].map((x) => (
        <mesh key={x} position={[x, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.13, 0.46, 8, 18]} />
          <meshStandardMaterial color={colors.host} />
        </mesh>
      ))}
      <BiologyLine color={colors.pathogen} lineWidth={5} points={SPIRAL_PATH} />
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Shows a prokaryotic cell without a nucleus but with nucleoid and ribosomes.
 */
function BacterialStructure({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.62, 1.55, 14, 32]} />
        <meshStandardMaterial
          color={colors.microbe}
          opacity={0.2}
          transparent
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusKnotGeometry args={[0.42, 0.026, 86, 6]} />
        <meshStandardMaterial color={colors.genome} />
      </mesh>
      {RIBOSOME_POINTS.map((point) => (
        <mesh
          key={point.id}
          position={[point.position[0] * 0.28, point.position[1] * 0.2, 0.36]}
        >
          <sphereGeometry args={[0.045, 10, 8]} />
          <meshStandardMaterial color={colors.spore} />
        </mesh>
      ))}
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[0, -0.75, 0]}
      >
        DNA
      </SceneLabel>
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Compares thick peptidoglycan and outer-membrane wall arrangements.
 */
function GramWallComparison({
  colors,
  label,
}: Pick<BiologySceneProps, "colors"> & { label: string }) {
  return (
    <group>
      <WallStack
        colors={[colors.microbe, colors.plant]}
        label="G+"
        textColor={colors.text}
        x={-0.7}
      />
      <WallStack
        colors={[colors.membrane, colors.microbe, colors.pathogen]}
        label="G-"
        textColor={colors.text}
        x={0.72}
      />
      <BiologySceneTitle color={colors.text}>{label}</BiologySceneTitle>
    </group>
  );
}

/**
 * Renders one bacterial wall stack with visible layer count.
 */
function WallStack({
  colors,
  label,
  textColor,
  x,
}: {
  colors: readonly string[];
  label: string;
  textColor: string;
  x: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      {colors.map((color, index) => (
        <mesh key={`${label}-${color}`} position={[0, index * 0.24 - 0.24, 0]}>
          <boxGeometry args={[0.78, 0.13, 0.26]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <SceneLabel color={textColor} fontSize="compact" position={[0, -0.68, 0]}>
        {label}
      </SceneLabel>
    </group>
  );
}
