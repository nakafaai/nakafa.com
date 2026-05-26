"use client";

import type { BiologySceneColors } from "@repo/design-system/components/contents/biology/data";
import { DnaDoubleHelix } from "@repo/design-system/components/contents/biology/parts";
import { useMemo } from "react";
import * as THREE from "three";

const BACILLUS_RIBOSOMES = [
  { id: "ribo-1", position: [-0.44, 0.08, 0.28], scale: 0.86 },
  { id: "ribo-2", position: [-0.26, -0.14, 0.3], scale: 0.72 },
  { id: "ribo-3", position: [-0.08, 0.18, 0.3], scale: 0.78 },
  { id: "ribo-4", position: [0.16, -0.12, 0.3], scale: 0.82 },
  { id: "ribo-5", position: [0.36, 0.12, 0.28], scale: 0.68 },
  { id: "ribo-6", position: [0.48, -0.04, 0.26], scale: 0.76 },
] as const;
const BACILLUS_SURFACE_GRAINS = [
  { id: "grain-1", position: [-0.58, 0.1, 0.29], scale: 0.9 },
  { id: "grain-2", position: [-0.34, -0.24, 0.26], scale: 0.74 },
  { id: "grain-3", position: [-0.02, 0.25, 0.28], scale: 0.82 },
  { id: "grain-4", position: [0.28, -0.22, 0.27], scale: 0.72 },
  { id: "grain-5", position: [0.58, 0.06, 0.25], scale: 0.78 },
  { id: "grain-6", position: [-0.48, -0.08, 0.3], scale: 0.64 },
  { id: "grain-7", position: [-0.18, 0.02, 0.31], scale: 0.58 },
  { id: "grain-8", position: [0.1, -0.28, 0.25], scale: 0.58 },
  { id: "grain-9", position: [0.42, 0.22, 0.24], scale: 0.62 },
] as const;
const BACILLUS_PILI = [
  {
    id: "pilus-left-top",
    points: [
      [-0.52, 0.22, 0.1],
      [-0.6, 0.28, 0.14],
      [-0.68, 0.34, 0.16],
    ],
  },
  {
    id: "pilus-right-top",
    points: [
      [-0.06, 0.28, 0.1],
      [-0.1, 0.36, 0.14],
      [-0.14, 0.44, 0.16],
    ],
  },
  {
    id: "pilus-center-bottom",
    points: [
      [0.18, -0.26, 0.1],
      [0.15, -0.34, 0.14],
      [0.12, -0.42, 0.16],
    ],
  },
  {
    id: "pilus-right",
    points: [
      [0.52, 0.16, 0.1],
      [0.6, 0.22, 0.14],
      [0.68, 0.28, 0.16],
    ],
  },
] as const;
const BACILLUS_FLAGELLUM = [
  [0.82, -0.02, 0.02],
  [0.98, -0.1, 0.06],
  [1.14, -0.02, 0.08],
  [1.3, 0.08, 0.07],
  [1.48, 0, 0.04],
] as const;
const BACILLUS_SURFACE_SIDES = [-1, 1] as const;
const BACILLUS_CAPSULE_SCALE = [1.16, 1.08, 1.16] as const;
const BACILLUS_CELL_WALL_SCALE = [1.02, 0.96, 1.02] as const;
const BACILLUS_CYTOPLASM_SCALE = [0.82, 0.82, 0.82] as const;
const COCCUS_CLUSTER = [
  [-0.22, 0.12, 0.02],
  [0.02, 0.2, -0.02],
  [0.24, 0.06, 0.04],
  [-0.08, -0.08, 0.06],
  [0.16, -0.18, -0.03],
] as const;
const SPIRILLUM_BODY = [
  [-0.62, -0.08, 0],
  [-0.42, 0.16, 0.04],
  [-0.16, -0.16, -0.03],
  [0.1, 0.16, 0.04],
  [0.38, -0.16, -0.03],
  [0.62, 0.08, 0],
] as const;
const SPIRILLUM_SURFACE_GRAINS = [
  [-0.44, 0.09, 0.09],
  [-0.22, -0.08, 0.08],
  [0.04, 0.08, 0.09],
  [0.28, -0.1, 0.08],
  [0.48, 0.02, 0.09],
] as const;

/**
 * Renders cocci as attached round bacterial cells instead of floating dots.
 */
export function CoccusClusterModel({
  colors,
  scale = 1,
}: {
  colors: Pick<BiologySceneColors, "host" | "microbe" | "spore">;
  scale?: number;
}) {
  return (
    <group scale={scale}>
      {COCCUS_CLUSTER.map((position, index) => (
        <group key={position.join("-")} position={position}>
          <mesh>
            <sphereGeometry args={[0.17, 24, 18]} />
            <meshStandardMaterial color={colors.microbe} roughness={0.82} />
          </mesh>
          <mesh scale={1.08}>
            <sphereGeometry args={[0.17, 24, 18]} />
            <meshStandardMaterial
              color={colors.host}
              opacity={0.16}
              roughness={0.94}
              transparent
            />
          </mesh>
          <mesh position={[0.04, 0.02, 0.15]}>
            <sphereGeometry args={[0.022 + index * 0.001, 8, 6]} />
            <meshStandardMaterial color={colors.spore} roughness={0.78} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Renders a spiral bacterium as a thick curved cell body with surface texture.
 */
export function SpirillumBacteriumModel({
  colors,
  scale = 1,
}: {
  colors: Pick<BiologySceneColors, "host" | "microbe" | "spore">;
  scale?: number;
}) {
  return (
    <group scale={scale}>
      <BacterialAppendage
        color={colors.microbe}
        points={SPIRILLUM_BODY}
        radius={0.082}
      />
      <BacterialAppendage
        color={colors.host}
        points={SPIRILLUM_BODY}
        radius={0.102}
        transparent
      />
      {SPIRILLUM_SURFACE_GRAINS.map((position) => (
        <mesh key={position.join("-")} position={position}>
          <sphereGeometry args={[0.026, 9, 7]} />
          <meshStandardMaterial color={colors.spore} roughness={0.78} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Renders a bacillus as a real bacterial cell, not a plain green capsule.
 */
export function BacillusBacteriumModel({
  colors,
  scale = 1,
  showFlagellum = true,
  showInterior = true,
  showPili = true,
}: {
  colors: Pick<
    BiologySceneColors,
    "genome" | "host" | "membrane" | "microbe" | "spore"
  >;
  scale?: number;
  showFlagellum?: boolean;
  showInterior?: boolean;
  showPili?: boolean;
}) {
  const capsuleOpacity = showInterior ? 0.16 : 0.1;
  const wallOpacity = showInterior ? 0.5 : 1;
  const cytoplasmOpacity = showInterior ? 0.2 : 0.16;

  return (
    <group scale={scale}>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={BACILLUS_CAPSULE_SCALE}>
        <capsuleGeometry args={[0.32, 0.98, 14, 34]} />
        <meshStandardMaterial
          color={colors.host}
          opacity={capsuleOpacity}
          roughness={0.94}
          transparent
        />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={BACILLUS_CELL_WALL_SCALE}>
        <capsuleGeometry args={[0.3, 0.96, 12, 30]} />
        <meshStandardMaterial
          color={colors.microbe}
          opacity={wallOpacity}
          roughness={0.86}
          transparent={showInterior}
        />
      </mesh>
      {showInterior ? (
        <mesh rotation={[0, 0, Math.PI / 2]} scale={BACILLUS_CYTOPLASM_SCALE}>
          <capsuleGeometry args={[0.3, 0.88, 10, 24]} />
          <meshStandardMaterial
            color={colors.host}
            opacity={cytoplasmOpacity}
            roughness={0.92}
            transparent
          />
        </mesh>
      ) : null}
      {BACILLUS_SURFACE_SIDES.map((side) => (
        <group key={`bacillus-surface-${side}`} scale={[1, 1, side]}>
          {BACILLUS_SURFACE_GRAINS.map((grain) => (
            <mesh key={grain.id} position={grain.position} scale={grain.scale}>
              <sphereGeometry args={[0.026, 10, 8]} />
              <meshStandardMaterial color={colors.microbe} roughness={0.88} />
            </mesh>
          ))}
        </group>
      ))}
      {showInterior ? <BacillusInterior colors={colors} /> : null}
      {showPili
        ? BACILLUS_SURFACE_SIDES.map((side) => (
            <group key={`bacillus-pili-${side}`} scale={[1, 1, side]}>
              {BACILLUS_PILI.map((pilus) => (
                <BacterialAppendage
                  color={colors.microbe}
                  key={pilus.id}
                  points={pilus.points}
                  radius={0.012}
                />
              ))}
            </group>
          ))
        : null}
      {showFlagellum
        ? BACILLUS_SURFACE_SIDES.map((side) => (
            <group key={`bacillus-flagellum-${side}`} scale={[1, 1, side]}>
              <BacterialAppendage
                color={colors.microbe}
                points={BACILLUS_FLAGELLUM}
                radius={0.018}
              />
            </group>
          ))
        : null}
    </group>
  );
}

/**
 * Builds a smooth bacterial appendage as real tube geometry instead of a line.
 */
function BacterialAppendage({
  color,
  points,
  radius,
  transparent = false,
}: {
  color: string;
  points: readonly (readonly [number, number, number])[];
  radius: number;
  transparent?: boolean;
}) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point))
      ),
    [points]
  );

  return (
    <mesh>
      <tubeGeometry args={[curve, 24, radius, 8, false]} />
      <meshStandardMaterial
        color={color}
        opacity={transparent ? 0.18 : 1}
        roughness={0.82}
        transparent={transparent}
      />
    </mesh>
  );
}

/**
 * Adds nucleoid DNA and ribosomes inside the bacillus without over-labeling it.
 */
function BacillusInterior({
  colors,
}: {
  colors: Pick<BiologySceneColors, "genome" | "membrane" | "spore">;
}) {
  return (
    <group>
      <group position={[-0.04, 0, 0.32]} rotation={[0.1, 0.04, -0.08]}>
        <DnaDoubleHelix
          backboneColor={colors.genome}
          length={0.88}
          lineWidth={2.2}
          pairColor={colors.spore}
          pairLineWidth={0.9}
          radius={0.04}
          turns={1.9}
        />
      </group>
      <mesh position={[0.36, -0.08, 0.31]} rotation={[Math.PI / 2, 0, 0.18]}>
        <torusGeometry args={[0.08, 0.009, 8, 40]} />
        <meshStandardMaterial color={colors.genome} roughness={0.74} />
      </mesh>
      {BACILLUS_RIBOSOMES.map((ribosome) => (
        <mesh
          key={ribosome.id}
          position={ribosome.position}
          scale={ribosome.scale}
        >
          <sphereGeometry args={[0.026, 10, 8]} />
          <meshStandardMaterial color={colors.spore} roughness={0.72} />
        </mesh>
      ))}
    </group>
  );
}
