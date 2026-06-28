"use client";

import { BacillusBacteriumModel } from "@repo/design-system/components/contents/biology/bacteria-parts";
import type {
  BiologyLabProps,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BacteriophageModel,
  MiniEnvelopedVirion,
} from "@repo/design-system/components/contents/biology/virus-parts";

const ROLE_VIEW = {
  cameraPosition: [0, 1.5, 3.18],
  cameraTarget: [0, 0.08, 0.16],
  narrowCameraPosition: [0, 1.82, 3.62],
} satisfies BiologySceneView;
const TARGET_BACTERIA = [
  {
    id: "infected",
    position: [-0.84, -0.06, 0],
    rotation: [0, 0, 0.08],
    showFlagellum: false,
  },
  {
    id: "center",
    position: [0.42, -0.06, 0],
    rotation: [0, 0, -0.08],
    showFlagellum: false,
  },
  {
    id: "right",
    position: [1.34, 0.16, -0.12],
    rotation: [0, 0, 0.16],
    showFlagellum: true,
  },
] as const;

/**
 * Renders the virus role lab with pathogenic, ecological, and biotechnology modes.
 */
export function VirusRoleLab(props: BiologyLabProps) {
  return <BiologyLabFrame scene={VirusRoleScene} view={ROLE_VIEW} {...props} />;
}

/**
 * Changes the whole scene so students do not read all virus roles as disease.
 */
function VirusRoleScene({ colors, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return (
      <group scale={0.86}>
        <EcologyRole colors={colors} />
      </group>
    );
  }

  if (selectedIndex === 2) {
    return (
      <group scale={0.86}>
        <BiotechRole colors={colors} />
      </group>
    );
  }

  return (
    <group scale={0.86}>
      <PathogenRole colors={colors} />
    </group>
  );
}

/**
 * Shows virus damage as a host cell with many pathogen particles.
 */
function PathogenRole({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh scale={[1.2, 0.78, 0.78]}>
        <sphereGeometry args={[1, 40, 24]} />
        <meshStandardMaterial color={colors.host} opacity={0.2} transparent />
      </mesh>
      {[-0.8, -0.38, 0.05, 0.52, 0.9].map((x, index) => (
        <group
          key={x}
          position={[x, 0.36 - Math.abs(x) * 0.24, 0.44 + index * 0.01]}
        >
          <MiniEnvelopedVirion colors={colors} scale={0.75} />
        </group>
      ))}
    </group>
  );
}

/**
 * Shows bacteriophages linking viruses to microbial population control.
 */
function EcologyRole({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      {TARGET_BACTERIA.map((bacterium) => (
        <group
          key={bacterium.id}
          position={bacterium.position}
          rotation={bacterium.rotation}
        >
          <BacillusBacteriumModel
            colors={colors}
            scale={0.82}
            showFlagellum={bacterium.showFlagellum}
            showInterior={false}
            showPili={false}
          />
        </group>
      ))}
      <group position={[-0.98, 0.42, 0.46]} rotation={[0, 0, -0.72]}>
        <BacteriophageModel colors={colors} scale={0.72} />
      </group>
    </group>
  );
}

/**
 * Shows a viral vector carrying a gene into a target cell.
 */
function BiotechRole({ colors }: Pick<BiologySceneProps, "colors">) {
  return (
    <group>
      <mesh position={[0.9, 0, 0]} scale={[0.82, 0.62, 0.62]}>
        <sphereGeometry args={[1, 40, 24]} />
        <meshStandardMaterial color={colors.host} opacity={0.24} transparent />
      </mesh>
      <group position={[-0.72, 0.08, 0.34]}>
        <MiniEnvelopedVirion colors={colors} scale={1.02} />
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18, 0.018, 8, 48]} />
          <meshStandardMaterial color={colors.genome} />
        </mesh>
      </group>
    </group>
  );
}
