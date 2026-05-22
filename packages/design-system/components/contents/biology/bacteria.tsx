"use client";

import {
  type BiologyLabProps,
  type BiologySceneProps,
  createBiologyGridPoints,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyLine,
  FloatingGroup,
  PulsingGroup,
  SlidingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";

const RIBOSOME_POINTS = createBiologyGridPoints(3, 4);
const COCCUS_POINTS = [
  [-0.92, 0.54, 0],
  [-0.68, 0.7, 0.05],
  [-0.46, 0.52, 0],
  [-0.7, 0.34, 0.05],
] as const;
const SPIRAL_PATH = [
  [-0.92, -0.5, 0],
  [-0.55, -0.22, 0],
  [-0.2, -0.52, 0],
  [0.16, -0.22, 0],
  [0.52, -0.52, 0],
  [0.9, -0.24, 0],
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
function BacteriaStructureScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <BacterialStructure colors={colors} />;
  }

  if (selectedIndex === 2) {
    return <GramWallComparison colors={colors} />;
  }

  return <BacterialShapes colors={colors} />;
}

/**
 * Shows coccus, bacillus, and spiral bacterial forms together.
 */
function BacterialShapes({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group scale={1.08}>
      {COCCUS_POINTS.map((position, index) => (
        <FloatingGroup
          key={position.join("-")}
          phase={index * 0.7}
          travel={0.04}
        >
          <mesh position={position}>
            <sphereGeometry args={[0.17, 18, 14]} />
            <meshStandardMaterial color={colors.microbe} />
          </mesh>
        </FloatingGroup>
      ))}
      {[0.42, 0.82].map((x, index) => (
        <SlidingGroup key={x} phase={index * 0.9} travel={0.045}>
          <mesh position={[x, 0.48, 0]} rotation={[0, 0, Math.PI / 2.4]}>
            <capsuleGeometry args={[0.14, 0.52, 8, 18]} />
            <meshStandardMaterial color={colors.host} />
          </mesh>
        </SlidingGroup>
      ))}
      <BiologyLine color={colors.pathogen} lineWidth={5} points={SPIRAL_PATH} />
    </group>
  );
}

/**
 * Shows a prokaryotic cell without a nucleus but with nucleoid and ribosomes.
 */
function BacterialStructure({ colors }: Pick<BiologySceneProps, "colors">) {
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
      <PulsingGroup speed={1.45} strength={0.06}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusKnotGeometry args={[0.42, 0.026, 86, 6]} />
          <meshStandardMaterial color={colors.genome} />
        </mesh>
      </PulsingGroup>
      {RIBOSOME_POINTS.map((point, index) => (
        <FloatingGroup key={point.id} phase={index * 0.28} travel={0.035}>
          <mesh
            position={[point.position[0] * 0.28, point.position[1] * 0.2, 0.36]}
          >
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color={colors.spore} />
          </mesh>
        </FloatingGroup>
      ))}
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[0, -0.75, 0]}
      >
        DNA
      </SceneLabel>
    </group>
  );
}

/**
 * Compares thick peptidoglycan and outer-membrane wall arrangements.
 */
function GramWallComparison({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <PulsingGroup phase={0.4} speed={1.1} strength={0.035}>
        <WallStack
          colors={[colors.microbe, colors.plant]}
          label="G+"
          textColor={colors.text}
          x={-0.7}
        />
      </PulsingGroup>
      <PulsingGroup phase={1.1} speed={1.1} strength={0.035}>
        <WallStack
          colors={[colors.membrane, colors.microbe, colors.pathogen]}
          label="G-"
          textColor={colors.text}
          x={0.72}
        />
      </PulsingGroup>
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
