import { RoundedBox } from "@react-three/drei";
import { CutNucleus } from "@repo/design-system/components/contents/biology/cell/nucleus";
import {
  type Keepout,
  Lysosomes,
  Mitochondria,
  Ribosomes,
} from "@repo/design-system/components/contents/biology/cell/organelles";
import { HalfShell } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  Instances,
  type Placement,
} from "@repo/design-system/components/contents/biology/instances";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { DoubleSide, Euler, Matrix4, Quaternion, Vector3 } from "three";

/** One micrometre of a 20 µm animal cell drawn with a radius of 1. */
const ANIMAL_UM = 1 / 10;

/** The nucleus of the animal cell: 6 µm across, off the middle. */
const NUCLEUS = { radius: 3 * ANIMAL_UM, x: -0.2, y: 0.05, z: -0.42 } as const;

/** Where the Golgi stack sits in the animal cell. */
const GOLGI = [0.42, 0.22, -0.45] as const;

/** The nucleus with its wrap of reticulum, and the Golgi stack, which nothing else may enter. */
const ANIMAL_KEEPOUT: readonly Keepout[] = [
  [NUCLEUS.x, NUCLEUS.y, NUCLEUS.z, NUCLEUS.radius + 0.2],
  [GOLGI[0], GOLGI[1], GOLGI[2], 0.2],
];

/**
 * An animal cell such as a liver cell, cut open: an uneven membrane with no
 * wall, a nucleus with its double envelope, pores, chromatin and nucleolus,
 * rough endoplasmic reticulum studded with ribosomes around it, a Golgi
 * stack shedding vesicles, lysosomes, mitochondria about 1.5 µm long, and
 * free ribosomes, each at its real size against the 20 µm cell.
 */
export function AnimalCell() {
  return (
    <group>
      <HalfShell
        color={CELL_COLORS.membrane}
        scale={[1, 1, 1]}
        thickness={0.02}
      />
      <CutNucleus
        position={[NUCLEUS.x, NUCLEUS.y, NUCLEUS.z]}
        radius={NUCLEUS.radius}
      />
      <Reticulum />
      <Golgi position={GOLGI} />
      <Lysosomes avoid={ANIMAL_KEEPOUT} count={8} size={ANIMAL_UM} />
      <Mitochondria
        avoid={ANIMAL_KEEPOUT}
        count={22}
        margin={0.12}
        size={ANIMAL_UM}
      />
      <Ribosomes
        avoid={ANIMAL_KEEPOUT}
        count={420}
        margin={0.05}
        size={ANIMAL_UM}
      />
    </group>
  );
}

/** The sheets of the rough endoplasmic reticulum, as segments of shells round the nucleus. */
const SHEETS = Arr.map(Arr.range(0, 3), (layer) => ({
  layer,
  phi: [Math.PI * (1.05 + 0.12 * layer), Math.PI * 0.55] as const,
  radius: NUCLEUS.radius + 0.07 + 0.05 * layer,
  theta: [Math.PI * (0.2 + 0.05 * layer), Math.PI * 0.55] as const,
  turn: 0.5 * layer,
}));

/**
 * Rough endoplasmic reticulum: folded sheets that wrap the nucleus in layers,
 * each a curved patch of membrane studded on its outer face with ribosomes.
 */
function Reticulum() {
  const studs = useMemo(
    () =>
      Arr.flatMap(SHEETS, ({ layer, phi, radius, theta, turn }) =>
        Arr.map(Arr.range(0, 69), (index): Placement => {
          const p = phi[0] + hashUnit(index, 60 + layer) * phi[1];
          const t = theta[0] + hashUnit(index, 70 + layer) * theta[1];
          const r = radius + 0.006;
          const local = new Vector3(
            -r * Math.cos(p) * Math.sin(t),
            r * Math.cos(t),
            r * Math.sin(p) * Math.sin(t)
          ).applyAxisAngle(new Vector3(0, 1, 0), turn);
          return { position: [local.x, local.y, local.z] };
        })
      ),
    []
  );
  return (
    <group position={[NUCLEUS.x, NUCLEUS.y, NUCLEUS.z]}>
      {Arr.map(SHEETS, ({ layer, phi, radius, theta, turn }) => (
        <mesh castShadow key={layer} rotation={[0, turn, 0]}>
          <sphereGeometry
            args={[radius, 48, 24, phi[0], phi[1], theta[0], theta[1]]}
          />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={CELL_COLORS.reticulum}
            opacity={0.85}
            roughness={0.5}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ))}
      <Instances placements={studs}>
        <sphereGeometry args={[0.006, 6, 4]} />
        <meshStandardMaterial color={CELL_COLORS.ribosome} roughness={0.8} />
      </Instances>
    </group>
  );
}

/** A Golgi stack: five flattened, curved sacs, with vesicles budding from their rims. */
function Golgi({
  position,
}: {
  readonly position: readonly [number, number, number];
}) {
  const vesicles = useMemo(
    () =>
      Arr.map(
        Arr.range(0, 9),
        (index): Placement => ({
          position: [
            (index % 2 === 0 ? 1 : -1) * (0.13 + hashUnit(index, 81) * 0.05),
            (hashUnit(index, 82) - 0.2) * 0.16,
            (hashUnit(index, 83) - 0.5) * 0.08,
          ],
        })
      ),
    []
  );
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
            color={CELL_COLORS.golgi}
            roughness={0.45}
          />
        </mesh>
      ))}
      <Instances placements={vesicles}>
        <sphereGeometry args={[0.014, 12, 8]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={CELL_COLORS.golgi}
          roughness={0.4}
        />
      </Instances>
    </group>
  );
}

/** One micrometre of a 40 µm leaf cell drawn 2 units long. */
const PLANT_UM = 1 / 20;

/** The leaf cell's half sizes, in drawing units: 40 by 24 by 24 µm. */
const PLANT = { x: 20 * PLANT_UM, y: 12 * PLANT_UM, z: 12 * PLANT_UM } as const;

/** The leaf cell's nucleus, pushed into a lower corner by the vacuole. */
const PLANT_NUCLEUS = {
  position: [-PLANT.x * 0.78, -PLANT.y * 0.62, -PLANT.z * 0.5] as const,
  radius: 3 * PLANT_UM,
};

/** The chloroplasts of the leaf cell, as placements of a unit sphere, none of them inside the nucleus. */
const CHLOROPLASTS = Arr.filter(
  Arr.map(Arr.range(0, 39), chloroplastSpot),
  ({ position }) =>
    Math.hypot(
      position[0] - PLANT_NUCLEUS.position[0],
      position[1] - PLANT_NUCLEUS.position[1],
      position[2] - PLANT_NUCLEUS.position[2]
    ) >
    PLANT_NUCLEUS.radius + 2.8 * PLANT_UM
);

/**
 * The grana inside each chloroplast: stacks of thylakoids seen through its
 * envelope, placed in the chloroplast's own frame and carried with it.
 */
const GRANA = Arr.flatMap(CHLOROPLASTS, (chloroplast, index) => {
  const frame = new Matrix4().compose(
    new Vector3(...chloroplast.position),
    new Quaternion().setFromEuler(
      new Euler(...(chloroplast.rotation ?? [0, 0, 0]))
    ),
    new Vector3(...(chloroplast.scale ?? [1, 1, 1]))
  );
  const turn = new Euler().setFromQuaternion(
    new Quaternion().setFromEuler(
      new Euler(...(chloroplast.rotation ?? [0, 0, 0]))
    )
  );
  return Arr.map(Arr.range(0, 6), (granum): Placement => {
    const at = new Vector3(
      (granum / 5 - 0.5) * 1.3 + (hashUnit(index, granum) - 0.5) * 0.12,
      (hashUnit(index, granum + 9) - 0.5) * 0.3,
      0
    ).applyMatrix4(frame);
    return {
      position: [at.x, at.y, at.z],
      rotation: [turn.x, turn.y, turn.z],
      scale: [1, 1, 1],
    };
  });
});

/**
 * A palisade cell of a leaf, cut open: a cellulose wall around the membrane,
 * a central vacuole that fills most of it, chloroplasts about 5 µm long
 * pressed against the walls with their grana showing through, and a
 * nucleus pushed to one side.
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
          clearcoat={0.6}
          color={CELL_COLORS.vacuole}
          opacity={0.45}
          roughness={0.08}
          transparent
        />
      </RoundedBox>
      <Instances placements={CHLOROPLASTS}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          color={CELL_COLORS.chloroplast}
          depthWrite={false}
          opacity={0.72}
          roughness={0.35}
          transparent
        />
      </Instances>
      <Instances placements={GRANA}>
        <cylinderGeometry
          args={[0.32 * PLANT_UM, 0.32 * PLANT_UM, 0.5 * PLANT_UM, 14]}
        />
        <meshStandardMaterial color={CELL_COLORS.granum} roughness={0.55} />
      </Instances>
      <CutNucleus
        position={PLANT_NUCLEUS.position}
        radius={PLANT_NUCLEUS.radius}
      />
    </group>
  );
}

/**
 * Where chloroplast `index` lies: in the thin cytoplasm between the vacuole
 * and one of the four side walls or the back wall, flattened against it.
 */
function chloroplastSpot(index: number): Placement {
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
  return { position, rotation, scale: flat };
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
        <RoundedBox
          args={[size[0], size[1], size[2]]}
          castShadow
          key={name}
          position={position}
          radius={thickness * 0.45}
          receiveShadow
          smoothness={3}
        >
          <meshPhysicalMaterial
            clearcoat={0.2}
            color={CELL_COLORS.cellWall}
            roughness={0.7}
          />
        </RoundedBox>
      ))}
    </group>
  );
}
