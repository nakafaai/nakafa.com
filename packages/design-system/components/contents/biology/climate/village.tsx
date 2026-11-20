import { MOORING } from "@repo/design-system/components/contents/biology/climate/boat";
import {
  groundAt,
  VILLAGE,
} from "@repo/design-system/components/contents/biology/climate/sea";
import type { Placement } from "@repo/design-system/components/contents/biology/instances";
import { Instances } from "@repo/design-system/components/contents/biology/instances";
import { useBumpySphere } from "@repo/design-system/components/contents/biology/surface";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CylinderGeometry,
  ExtrudeGeometry,
  QuadraticBezierCurve3,
  Shape,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** The sea wall's landward face and seaward toe, in metres inland of today's high tide, in front of the whole village. */
const WALL = { face: -20.2, toe: -23.8 } as const;

/** Where a sea wall that holds stops the water: inside the wall, under its crest. */
export const WALL_LINE = -20.6;

/** The coast the wall and the sea run along, in metres. */
const COAST = 300;

/**
 * A concrete sea wall in front of the village: a vertical landward face, a
 * sloping seaward face, footed 0.5 m into the sand, under a cap whose top is
 * the model's crest, 2.5 m above today's high tide.
 */
export function SeaWall() {
  const geometry = useMemo(() => {
    const base = groundAt(WALL.toe) - 0.5;
    const shape = new Shape();
    shape.moveTo(WALL.face, base);
    shape.lineTo(WALL.face, VILLAGE.wall - 0.15);
    shape.lineTo(WALL.face - 1, VILLAGE.wall - 0.15);
    shape.lineTo(WALL.toe, base);
    shape.closePath();
    return new ExtrudeGeometry(shape, {
      bevelEnabled: false,
      depth: COAST,
    }).translate(0, 0, -COAST / 2);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial color={MACHINE_COLORS.concrete} roughness={0.9} />
      </mesh>
      <mesh
        castShadow
        position={[WALL.face - 0.55, VILLAGE.wall - 0.075, 0]}
        receiveShadow
      >
        <boxGeometry args={[1.3, 0.15, COAST]} />
        <meshStandardMaterial color={MACHINE_COLORS.concrete} roughness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * The mangroves of the belt, each `[x, z, size]`, on the mudflat in front of
 * the wall's line, round a clearing where the perahu lies at anchor.
 */
const GROVE = Arr.filter(
  Arr.map(Arr.range(0, 179), (tree) => {
    const x = -27.5 - hashUnit(tree, 1) * 34;
    const depth = -groundAt(x);
    return [
      x,
      (hashUnit(tree, 2) - 0.5) * 110,
      0.85 + depth * 0.18 + hashUnit(tree, 3) * 0.3,
    ] as const;
  }),
  ([x, z]) => Math.abs(z - MOORING[2]) > 7 || x < MOORING[0] - 9
);

/** The lobes of a crown: where each sits from the trunk, how high, and how large, in tree sizes. */
const LOBES = [
  { height: 3.7, out: 0, size: 1.5 },
  { height: 3.35, out: 1.1, size: 1.15 },
  { height: 3.45, out: 1, size: 1.2 },
  { height: 3.1, out: 1.2, size: 1 },
] as const;

/** Eight prop roots arching from the trunk into the mud, as a red mangrove stands on them. */
function propRoots() {
  return mergeGeometries(
    Arr.map(Arr.range(0, 7), (root) => {
      const turn = (root / 8) * Math.PI * 2 + hashUnit(root, 7) * 0.4;
      const out = new Vector3(Math.cos(turn), 0, Math.sin(turn));
      const reach = 1.2 + hashUnit(root, 8) * 0.5;
      return new TubeGeometry(
        new QuadraticBezierCurve3(
          out.clone().multiplyScalar(0.08).setY(1.4),
          out
            .clone()
            .multiplyScalar(reach * 0.6)
            .setY(1.6),
          out.clone().multiplyScalar(reach).setY(-0.3)
        ),
        14,
        0.05,
        5,
        false
      );
    })
  );
}

/**
 * A belt of red mangroves on the mudflat in front of the beach: each tree a
 * spread of arching prop roots, a short trunk, and a dense, uneven crown.
 */
export function Mangroves() {
  const roots = useMemo(propRoots, []);
  const trunk = useMemo(
    () => new CylinderGeometry(0.09, 0.13, 2.4, 7).translate(0, 2.5, 0),
    []
  );
  useEffect(
    () => () => {
      roots.dispose();
      trunk.dispose();
    },
    [roots, trunk]
  );
  const crown = useBumpySphere(1, 4, 0.14);
  const stands: readonly Placement[] = Arr.map(GROVE, ([x, z, size], tree) => ({
    position: [x, groundAt(x), z],
    rotation: [0, hashUnit(tree, 5) * Math.PI * 2, 0],
    scale: [size, size, size],
  }));
  const lobes = Arr.flatMap(GROVE, ([x, z, size], tree) =>
    Arr.map(LOBES, (lobe, index) => {
      const turn = hashUnit(tree, 6 + index) * Math.PI * 2;
      return {
        dark: (tree + index) % 2 === 0,
        placement: {
          position: [
            x + Math.cos(turn) * lobe.out * size,
            groundAt(x) + lobe.height * size,
            z + Math.sin(turn) * lobe.out * size,
          ],
          rotation: [0, turn, 0],
          scale: [lobe.size * size, lobe.size * 0.8 * size, lobe.size * size],
        } satisfies Placement,
      };
    })
  );
  return (
    <group>
      <Instances placements={stands}>
        <primitive attach="geometry" object={roots} />
        <meshStandardMaterial
          color={ECOLOGY_COLORS.mangroveRoot}
          roughness={0.95}
        />
      </Instances>
      <Instances placements={stands}>
        <primitive attach="geometry" object={trunk} />
        <meshStandardMaterial color={ROAD_COLORS.bark} roughness={0.95} />
      </Instances>
      <Instances
        placements={Arr.map(
          Arr.filter(lobes, ({ dark }) => dark),
          ({ placement }) => placement
        )}
      >
        <primitive attach="geometry" object={crown} />
        <meshStandardMaterial
          color={ROAD_COLORS.foliageDark}
          roughness={0.85}
        />
      </Instances>
      <Instances
        placements={Arr.map(
          Arr.filter(lobes, ({ dark }) => !dark),
          ({ placement }) => placement
        )}
      >
        <primitive attach="geometry" object={crown} />
        <meshStandardMaterial
          color={ROAD_COLORS.foliageShade}
          roughness={0.85}
        />
      </Instances>
    </group>
  );
}

/**
 * The sea, a wide sheet of water whose surface stands at `level` metres. It
 * reaches inland under the land, or only as far as `reach` when a sea wall
 * holds it back.
 */
export function Sea({
  level,
  reach = 80,
}: {
  readonly level: number;
  readonly reach?: number | undefined;
}) {
  const seaward = -340;
  return (
    <mesh
      position={[(seaward + reach) / 2, level, 0]}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[reach - seaward, COAST]} />
      <meshPhysicalMaterial
        clearcoat={1}
        clearcoatRoughness={0.1}
        color={ECOLOGY_COLORS.seawater}
        opacity={0.9}
        roughness={0.12}
        transparent
      />
    </mesh>
  );
}
