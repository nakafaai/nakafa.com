"use client";

import {
  BacillusBacteriumModel,
  CoccusClusterModel,
  SpirillumBacteriumModel,
} from "@repo/design-system/components/contents/biology/bacteria-parts";
import type {
  BiologyLabProps,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import { SceneLabel } from "@repo/design-system/components/contents/scene-label";

const BACTERIA_VIEW = {
  cameraPosition: [2.28, 1.58, 3.3],
  cameraTarget: [0, -0.05, 0],
  narrowCameraPosition: [2.64, 1.82, 3.9],
} satisfies BiologySceneView;

/**
 * Renders bacterial shape, structure, and cell-wall comparison views.
 */
export function BacteriaStructureLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame
      scene={BacteriaStructureScene}
      view={BACTERIA_VIEW}
      {...props}
    />
  );
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
    <group scale={1.22}>
      <group position={[-0.92, 0.34, 0]}>
        <CoccusClusterModel colors={colors} scale={0.96} />
        <SceneLabel
          color={colors.text}
          fontSize="compact"
          position={[0, -0.42, 0.24]}
        >
          Kokus
        </SceneLabel>
      </group>
      <group position={[0.18, 0.32, 0]} rotation={[0.1, 0, -0.18]}>
        <BacillusBacteriumModel
          colors={colors}
          scale={0.78}
          showInterior={false}
          showPili={false}
        />
        <SceneLabel
          color={colors.text}
          fontSize="compact"
          position={[0, -0.52, 0.28]}
        >
          Basilus
        </SceneLabel>
      </group>
      <group position={[0.92, -0.42, 0]} rotation={[0, 0, -0.18]}>
        <SpirillumBacteriumModel colors={colors} scale={1.02} />
        <SceneLabel
          color={colors.text}
          fontSize="compact"
          position={[0, -0.36, 0.26]}
        >
          Spiral
        </SceneLabel>
      </group>
    </group>
  );
}

/**
 * Shows a prokaryotic cell without a nucleus but with nucleoid and ribosomes.
 */
function BacterialStructure({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <group rotation={[0, 0, -0.08]}>
        <BacillusBacteriumModel colors={colors} scale={1.18} />
      </group>
      <SceneLabel
        color={colors.text}
        fontSize="compact"
        position={[0.58, -0.34, 0.72]}
      >
        Nukleoid DNA
      </SceneLabel>
    </group>
  );
}

/**
 * Compares thick peptidoglycan and outer-membrane wall arrangements.
 */
function GramWallComparison({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group position={[0, 0.32, 0]}>
      <WallStack
        colors={[colors.microbe, colors.plant]}
        label="Gram positif"
        textColor={colors.text}
        x={-0.7}
      />
      <WallStack
        colors={[colors.membrane, colors.microbe, colors.pathogen]}
        label="Gram negatif"
        textColor={colors.text}
        x={0.72}
      />
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
      {colors.map((color, index) => {
        const radius = 0.25 - index * 0.035;
        const length = 0.8 - index * 0.08;
        const opacity = index === colors.length - 1 ? 0.78 : 0.34;

        return (
          <mesh
            key={`${label}-${color}`}
            position={[0, 0.02, index * 0.055]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <capsuleGeometry args={[radius, length, 10, 24]} />
            <meshStandardMaterial
              color={color}
              opacity={opacity}
              roughness={0.82}
              transparent
            />
          </mesh>
        );
      })}
      <SceneLabel
        color={textColor}
        fontSize="compact"
        position={[0, 0.44, 0.72]}
      >
        {label}
      </SceneLabel>
    </group>
  );
}
