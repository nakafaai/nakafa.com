import { RoundedBox } from "@react-three/drei";
import { spotInHalf } from "@repo/design-system/components/contents/biology/cell/anatomy";
import {
  HalfShell,
  Scatter,
} from "@repo/design-system/components/contents/biology/cell/parts";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import { DoubleSide } from "three";

/** One micrometre of a 20 µm animal cell drawn with a radius of 1. */
const ANIMAL_UM = 1 / 10;

/** The nucleus of the animal cell: 6 µm across, off the middle. */
const NUCLEUS = { radius: 3 * ANIMAL_UM, x: -0.2, y: 0.05, z: -0.42 } as const;

/**
 * An animal cell such as a liver cell, cut open: a membrane with no wall, a
 * nucleus with its nucleolus and pores, rough endoplasmic reticulum around
 * it, a Golgi stack, mitochondria about 1.5 µm long, and ribosomes, each at
 * its real size against the 20 µm cell.
 */
export function AnimalCell() {
  return (
    <group>
      <HalfShell color={MATERIAL.membrane} scale={[1, 1, 1]} thickness={0.02} />
      <Nucleus />
      <Reticulum />
      <Golgi position={[0.42, 0.22, -0.45]} />
      <Mitochondria count={22} margin={0.12} size={ANIMAL_UM} />
      <Ribosomes count={420} margin={0.05} size={ANIMAL_UM} />
    </group>
  );
}

/** The nucleus cut open: its envelope, its pores and its dark nucleolus. */
function Nucleus() {
  return (
    <group position={[NUCLEUS.x, NUCLEUS.y, NUCLEUS.z]}>
      <mesh castShadow>
        <sphereGeometry args={[NUCLEUS.radius, 48, 32, Math.PI, Math.PI]} />
        <meshPhysicalMaterial
          clearcoat={0.6}
          color={MATERIAL.nucleus}
          roughness={0.45}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0.05, 0.04, -0.1]}>
        <sphereGeometry args={[NUCLEUS.radius * 0.36, 32, 24]} />
        <meshStandardMaterial color={MATERIAL.nucleolus} roughness={0.6} />
      </mesh>
      <Scatter
        count={40}
        place={(index) => {
          const theta = Math.acos(2 * hashUnit(index, 41) - 1);
          const phi = Math.PI + hashUnit(index, 42) * Math.PI;
          const r = NUCLEUS.radius * 1.01;
          return [
            [
              r * Math.sin(theta) * Math.cos(phi),
              r * Math.cos(theta),
              r * Math.sin(theta) * Math.sin(phi),
            ],
            [0, 0, 0],
            [1, 1, 1],
          ];
        }}
      >
        <sphereGeometry args={[0.009, 8, 6]} />
        <meshStandardMaterial color={MATERIAL.nucleolus} roughness={0.7} />
      </Scatter>
    </group>
  );
}

/**
 * Rough endoplasmic reticulum: folded sheets that wrap the nucleus in layers,
 * each a curved patch of membrane studded with ribosomes.
 */
function Reticulum() {
  return (
    <group position={[NUCLEUS.x, NUCLEUS.y, NUCLEUS.z]}>
      {Arr.map(Arr.range(0, 3), (layer) => (
        <mesh castShadow key={layer} rotation={[0, 0.5 * layer, 0]}>
          <sphereGeometry
            args={[
              NUCLEUS.radius + 0.07 + 0.05 * layer,
              48,
              24,
              Math.PI * (1.05 + 0.12 * layer),
              Math.PI * 0.55,
              Math.PI * (0.2 + 0.05 * layer),
              Math.PI * 0.55,
            ]}
          />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={MATERIAL.reticulum}
            opacity={0.85}
            roughness={0.5}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/** A Golgi stack: five flattened, curved sacs. */
function Golgi({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  return (
    <group position={position} rotation={[0.5, 0.4, 0.3]}>
      {Arr.map(Arr.range(0, 4), (sac) => (
        <mesh
          castShadow
          key={sac}
          position={[0, sac * 0.03, 0]}
          scale={[1, 0.18, 0.55]}
        >
          <torusGeometry
            args={[0.12 - sac * 0.01, 0.035, 12, 40, Math.PI * 1.2]}
          />
          <meshPhysicalMaterial
            clearcoat={0.4}
            color={MATERIAL.golgi}
            roughness={0.45}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Mitochondria: capsules about 1.5 µm long and 0.5 µm wide at `size` per µm. */
export function Mitochondria({
  count,
  margin,
  size,
}: {
  readonly count: number;
  readonly margin: number;
  readonly size: number;
}) {
  return (
    <Scatter
      count={count}
      place={(index) => [
        spotInHalf(index, 11, margin),
        [hashUnit(index, 12) * 3, hashUnit(index, 13) * 3, 0],
        [1, 1, 1],
      ]}
    >
      <capsuleGeometry args={[0.25 * size, 1 * size, 6, 12]} />
      <meshPhysicalMaterial
        clearcoat={0.5}
        color={MATERIAL.mitochondrion}
        roughness={0.4}
      />
    </Scatter>
  );
}

/** Ribosomes: grains 25 nm across, drawn at `size` per µm. */
export function Ribosomes({
  count,
  margin,
  size,
}: {
  readonly count: number;
  readonly margin: number;
  readonly size: number;
}) {
  const radius = Math.max(0.006, 0.0125 * size);
  return (
    <Scatter
      count={count}
      place={(index) => [spotInHalf(index, 21, margin), [0, 0, 0], [1, 1, 1]]}
    >
      <sphereGeometry args={[radius, 6, 4]} />
      <meshStandardMaterial color={MATERIAL.ribosome} roughness={0.8} />
    </Scatter>
  );
}

/** One micrometre of a 40 µm leaf cell drawn 2 units long. */
const PLANT_UM = 1 / 20;

/** The leaf cell's half sizes, in drawing units: 40 by 24 by 24 µm. */
const PLANT = { x: 20 * PLANT_UM, y: 12 * PLANT_UM, z: 12 * PLANT_UM } as const;

/**
 * A palisade cell of a leaf, cut open: a cellulose wall around the membrane,
 * a central vacuole that fills most of it, chloroplasts about 5 µm long
 * pressed against the walls, a nucleus pushed to one side, and a few
 * mitochondria.
 */
export function PlantCell() {
  const wall = 0.6 * PLANT_UM;
  return (
    <group>
      <Wall depth={PLANT.z} thickness={wall} />
      <RoundedBox
        args={[PLANT.x * 1.7, PLANT.y * 1.55, PLANT.z * 0.82]}
        position={[0.06, 0, -PLANT.z * 0.48]}
        radius={0.12}
        smoothness={4}
      >
        <meshPhysicalMaterial
          color={MATERIAL.vacuole}
          opacity={0.55}
          roughness={0.1}
          transparent
        />
      </RoundedBox>
      <Scatter count={34} place={(index) => chloroplastSpot(index)}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={MATERIAL.chloroplast}
          roughness={0.45}
        />
      </Scatter>
      <mesh
        castShadow
        position={[-PLANT.x * 0.78, -PLANT.y * 0.62, -PLANT.z * 0.5]}
      >
        <sphereGeometry args={[3 * PLANT_UM, 32, 24]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={MATERIAL.nucleus}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}

/**
 * Where chloroplast `index` lies: in the thin cytoplasm between the vacuole
 * and one of the four side walls or the back wall, flattened against it.
 */
function chloroplastSpot(index: number) {
  const side = index % 5;
  const along = hashUnit(index, 31) * 2 - 1;
  const across = hashUnit(index, 32);
  const length = 2.5 * PLANT_UM;
  const flat = [length, 1.2 * PLANT_UM, 0.8 * PLANT_UM] as const;
  const inset = 1.6 * PLANT_UM;
  const sides = [
    [
      [along * PLANT.x * 0.85, PLANT.y - inset, -across * PLANT.z * 0.9],
      [0, 0, 0],
    ],
    [
      [along * PLANT.x * 0.85, -PLANT.y + inset, -across * PLANT.z * 0.9],
      [0, 0, 0],
    ],
    [
      [PLANT.x - inset, along * PLANT.y * 0.8, -across * PLANT.z * 0.9],
      [0, 0, Math.PI / 2],
    ],
    [
      [-PLANT.x + inset, along * PLANT.y * 0.8, -across * PLANT.z * 0.9],
      [0, 0, Math.PI / 2],
    ],
    [
      [
        along * PLANT.x * 0.85,
        (across * 2 - 1) * PLANT.y * 0.8,
        -PLANT.z + inset,
      ],
      [Math.PI / 2, 0, 0],
    ],
  ] as const;
  const [position, rotation] = sides[side] ?? sides[0];
  return [position, rotation, flat] as const;
}

/** The cellulose wall's back and four sides, open at the front cut. */
function Wall({
  depth,
  thickness,
}: {
  readonly depth: number;
  readonly thickness: number;
}) {
  const slabs = [
    ["back", [0, 0, -depth], [PLANT.x * 2, PLANT.y * 2, thickness]],
    ["top", [0, PLANT.y, -depth / 2], [PLANT.x * 2, thickness, depth]],
    ["bottom", [0, -PLANT.y, -depth / 2], [PLANT.x * 2, thickness, depth]],
    ["right", [PLANT.x, 0, -depth / 2], [thickness, PLANT.y * 2, depth]],
    ["left", [-PLANT.x, 0, -depth / 2], [thickness, PLANT.y * 2, depth]],
  ] as const;
  return (
    <group>
      {Arr.map(slabs, ([name, position, size]) => (
        <mesh castShadow key={name} position={position} receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={MATERIAL.cellWall} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}
