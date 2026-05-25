"use client";

import { BacillusBacteriumModel } from "@repo/design-system/components/contents/biology/bacteria-parts";
import {
  BiologyCallouts,
  type BiologyCalloutTarget,
} from "@repo/design-system/components/contents/biology/callouts";
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
  maxAzimuthAngle: Math.PI * 0.16,
  maxPolarAngle: Math.PI * 0.42,
  minAzimuthAngle: Math.PI * -0.16,
  minPolarAngle: Math.PI * 0.28,
  narrowCameraPosition: [0, 1.82, 3.62],
} satisfies BiologySceneView;
const PATHOGEN_CALLOUT_TARGETS = [
  {
    id: "host-cell",
    labelPosition: [-1.06, 1.04, 0.9],
  },
  {
    id: "virus-particle",
    labelPosition: [0.94, 1.04, 0.9],
    target: [0.9, 0.18, 0.58],
  },
] satisfies readonly BiologyCalloutTarget[];
const ECOLOGY_CALLOUT_TARGETS = [
  {
    id: "bacteriophage",
    labelPosition: [-1.02, 1.1, 0.9],
    target: [-0.78, 0.75, 0.5],
  },
  {
    id: "target-bacteria",
    labelPosition: [0.5, 1.02, 0.88],
  },
] satisfies readonly BiologyCalloutTarget[];
const BIOTECH_CALLOUT_TARGETS = [
  {
    id: "gene-cargo",
    labelPosition: [-1.08, 1.34, 1.04],
    target: [-0.72, 0.1, 0.48],
  },
  {
    id: "target-cell",
    labelPosition: [0.72, 1.04, 0.9],
  },
] satisfies readonly BiologyCalloutTarget[];
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
function VirusRoleScene({ colors, item, selectedIndex }: BiologySceneProps) {
  if (selectedIndex === 1) {
    return <EcologyRole colors={colors} item={item} />;
  }

  if (selectedIndex === 2) {
    return <BiotechRole colors={colors} item={item} />;
  }

  return <PathogenRole colors={colors} item={item} />;
}

/**
 * Shows virus damage as a host cell with many pathogen particles.
 */
function PathogenRole({
  colors,
  item,
}: Pick<BiologySceneProps, "colors" | "item">) {
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
      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={PATHOGEN_CALLOUT_TARGETS}
      />
    </group>
  );
}

/**
 * Shows bacteriophages linking viruses to microbial population control.
 */
function EcologyRole({
  colors,
  item,
}: Pick<BiologySceneProps, "colors" | "item">) {
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
      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={ECOLOGY_CALLOUT_TARGETS}
      />
    </group>
  );
}

/**
 * Shows a viral vector carrying a gene into a target cell.
 */
function BiotechRole({
  colors,
  item,
}: Pick<BiologySceneProps, "colors" | "item">) {
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
      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={BIOTECH_CALLOUT_TARGETS}
      />
    </group>
  );
}
