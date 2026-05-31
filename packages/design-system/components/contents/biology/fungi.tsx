"use client";

import { useFrame } from "@react-three/fiber";
import { BiologyCallouts } from "@repo/design-system/components/contents/biology/callouts";
import type {
  BiologyLabProps,
  BiologyScenePoint,
  BiologySceneProps,
  BiologySceneView,
} from "@repo/design-system/components/contents/biology/data";
import { BiologyLabFrame } from "@repo/design-system/components/contents/biology/lab-frame";
import {
  BiologyTube,
  FloatingGroup,
} from "@repo/design-system/components/contents/biology/parts";
import { useMemo, useRef } from "react";
import { CatmullRomCurve3, type Mesh, Vector3 } from "three";

const FUNGI_VIEW = {
  cameraPosition: [2.25, 1.7, 3.05],
  cameraTarget: [0.02, 0.18, 0.02],
  maxAzimuthAngle: Math.PI / 16,
  maxPolarAngle: Math.PI / 2.4,
  minAzimuthAngle: -Math.PI / 16,
  minPolarAngle: Math.PI / 3.1,
  narrowCameraPosition: [2.78, 2.1, 3.85],
} satisfies BiologySceneView;

const AERIAL_HYPHA_POINTS = [
  [0.16, 0.02, 0],
  [0.18, 0.34, 0.04],
  [0.1, 0.68, 0.14],
  [0.18, 0.96, 0.2],
] satisfies BiologyScenePoint[];

const HYPHA_PATHS = [
  [
    "main",
    [
      [-1.34, -0.02, 0.05],
      [-0.9, 0.02, 0.02],
      [-0.45, 0.04, 0.08],
      [0.05, 0.02, 0],
      [0.5, 0.05, -0.08],
      [1.1, 0.02, -0.02],
    ],
  ],
  [
    "front",
    [
      [-0.5, 0.04, 0.08],
      [-0.66, 0.13, 0.48],
      [-0.92, 0.19, 0.8],
    ],
  ],
  [
    "back",
    [
      [0.1, 0.02, 0],
      [-0.04, 0.12, -0.4],
      [-0.3, 0.18, -0.72],
    ],
  ],
  [
    "right",
    [
      [0.48, 0.05, -0.08],
      [0.72, 0.16, 0.26],
      [1.1, 0.24, 0.5],
    ],
  ],
  ["aerial", AERIAL_HYPHA_POINTS],
] satisfies readonly [string, readonly BiologyScenePoint[]][];

const SUBSTRATE_GRAINS = [
  { id: "soy-1", position: [-1.05, -0.22, -0.32], scale: [0.36, 0.18, 0.28] },
  { id: "soy-2", position: [-0.58, -0.24, 0.28], scale: [0.34, 0.17, 0.3] },
  { id: "soy-3", position: [-0.12, -0.25, -0.18], scale: [0.42, 0.16, 0.27] },
  { id: "soy-4", position: [0.36, -0.22, 0.24], scale: [0.38, 0.18, 0.26] },
  { id: "soy-5", position: [0.86, -0.24, -0.2], scale: [0.34, 0.16, 0.3] },
] as const;

const SEPTA_POINTS = [
  [-0.78, 0.03, 0.04],
  [-0.18, 0.04, 0.05],
  [0.42, 0.04, -0.06],
  [0.17, 0.58, 0.1],
] satisfies BiologyScenePoint[];

const SPORE_POINTS = [
  [0, 1.12, 0.18],
  [0.16, 1.18, 0.28],
  [0.32, 1.08, 0.18],
  [0.2, 1, 0.04],
  [0.04, 1.04, 0.36],
] satisfies BiologyScenePoint[];

const CALLOUT_TARGETS = [
  {
    id: "hypha",
    labelPosition: [-1.18, 0.52, 0.58],
    target: [-0.8, 0.04, 0.04],
  },
  {
    id: "mycelium",
    labelPosition: [1.32, 0.64, -0.44],
    target: [0.3, 0.12, 0.18],
  },
  {
    id: "spore",
    labelPosition: [0.7, 1.36, 0.38],
    target: [0.22, 1.12, 0.24],
  },
  {
    id: "enzyme",
    labelPosition: [-0.92, 0.24, -0.62],
    target: [-0.34, -0.02, -0.12],
  },
] as const;

export function FungiMyceliumLab(props: BiologyLabProps) {
  return (
    <BiologyLabFrame scene={FungiMyceliumScene} view={FUNGI_VIEW} {...props} />
  );
}

function FungiMyceliumScene({ colors, item }: BiologySceneProps) {
  return (
    <group rotation={[-0.1, -0.34, 0.04]} scale={1.25}>
      <Substrate color={colors.grain} detailColor={colors.wood} />
      <EnzymeHalo color={colors.decomposer} />
      <HyphaNetwork
        coreColor={colors.decomposer}
        pulseColor={colors.spore}
        wallColor={colors.skyLight}
      />
      <SporeHead color={colors.spore} stemColor={colors.decomposer} />
      <BiologyCallouts
        callouts={item.callouts}
        color={colors.text}
        targets={CALLOUT_TARGETS}
      />
    </group>
  );
}

function Substrate({
  color,
  detailColor,
}: {
  color: string;
  detailColor: string;
}) {
  return (
    <group>
      <mesh
        position={[0, -0.34, 0]}
        rotation={[0, 0.08, 0]}
        scale={[1.76, 0.1, 0.7]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={detailColor}
          opacity={0.2}
          roughness={0.96}
          transparent
        />
      </mesh>
      {SUBSTRATE_GRAINS.map((grain) => (
        <mesh key={grain.id} position={grain.position} scale={grain.scale}>
          <sphereGeometry args={[1, 28, 18]} />
          <meshStandardMaterial color={color} roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

function HyphaNetwork({
  coreColor,
  pulseColor,
  wallColor,
}: {
  coreColor: string;
  pulseColor: string;
  wallColor: string;
}) {
  return (
    <group>
      {HYPHA_PATHS.map(([id, points]) => (
        <group key={id}>
          <BiologyTube
            color={wallColor}
            opacity={0.84}
            points={points}
            radius={0.05}
            segments={42}
          />
          <BiologyTube
            color={coreColor}
            opacity={0.9}
            points={points}
            radius={0.026}
            segments={42}
          />
        </group>
      ))}
      {SEPTA_POINTS.map((point) => (
        <mesh key={point.join("-")} position={point} scale={[1, 0.34, 1]}>
          <sphereGeometry args={[0.052, 14, 10]} />
          <meshStandardMaterial
            color={wallColor}
            opacity={0.78}
            roughness={0.7}
            transparent
          />
        </mesh>
      ))}
      {HYPHA_PATHS.slice(0, 4).map(([id, points], index) => (
        <NutrientPulse
          color={pulseColor}
          delay={index * 0.14}
          key={id}
          points={points}
        />
      ))}
    </group>
  );
}

function NutrientPulse({
  color,
  delay,
  points,
}: {
  color: string;
  delay: number;
  points: readonly BiologyScenePoint[];
}) {
  const ref = useRef<Mesh>(null);
  const curve = useMemo(
    () => new CatmullRomCurve3(points.map((point) => new Vector3(...point))),
    [points]
  );

  useFrame(({ clock }) => {
    if (!ref.current) {
      return;
    }

    ref.current.position.copy(
      curve.getPoint((clock.elapsedTime * 0.1 + delay) % 1)
    );
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.044, 16, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.28}
        roughness={0.48}
      />
    </mesh>
  );
}

function EnzymeHalo({ color }: { color: string }) {
  return (
    <mesh position={[-0.16, -0.08, -0.04]} scale={[1.12, 0.055, 0.58]}>
      <sphereGeometry args={[1, 32, 12]} />
      <meshStandardMaterial
        color={color}
        opacity={0.14}
        roughness={0.9}
        transparent
      />
    </mesh>
  );
}

function SporeHead({ color, stemColor }: { color: string; stemColor: string }) {
  return (
    <group>
      <BiologyTube
        color={stemColor}
        opacity={0.92}
        points={AERIAL_HYPHA_POINTS}
        radius={0.025}
        segments={38}
      />
      {SPORE_POINTS.map((point, index) => (
        <FloatingGroup
          key={point.join("-")}
          phase={index * 0.44}
          travel={0.035}
        >
          <mesh position={point}>
            <sphereGeometry args={[0.072, 18, 12]} />
            <meshStandardMaterial color={color} roughness={0.68} />
          </mesh>
        </FloatingGroup>
      ))}
    </group>
  );
}
