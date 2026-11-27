import { Instance, Instances } from "@react-three/drei";
import { grainTexture } from "@repo/design-system/components/contents/physics/kinematics/grain";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { Vector2 } from "three";

/** How far from the road's middle the row of trees stands, toward the pavement, in metres. */
const ROW = -10;

/** How many leafy masses make up one crown, and how many boughs carry them. */
const CROWN_LUMPS = 30;
const BOUGHS = 5;

/** The golden angle, which spreads the masses of a crown evenly around it. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Leaf greens of a tropical roadside tree, sunlit to shaded. */
const LEAVES = [
  ROAD_COLORS.foliageShade,
  ROAD_COLORS.foliage,
  ROAD_COLORS.foliageDark,
  ROAD_COLORS.foliageLight,
] as const;

/** A trunk's outline from its flared roots to the fork, as radius and height in metres. */
const TRUNK = [
  new Vector2(0.56, 0),
  new Vector2(0.4, 0.12),
  new Vector2(0.31, 0.4),
  new Vector2(0.26, 0.95),
  new Vector2(0.235, 1.8),
  new Vector2(0.215, 2.7),
  new Vector2(0.2, 3.4),
  new Vector2(0.17, 3.9),
  new Vector2(0.1, 4.25),
];

/**
 * The masses of one crown: the wide, flat-topped umbrella a rain tree
 * spreads over a road, highest over the trunk and drooping at its rim, made
 * of many leafy masses that shrink toward the rim. Every tree draws its own
 * from the grain hash, so no two trees match.
 */
function crownOf(x: number, tree: number) {
  return Arr.map(Arr.range(0, CROWN_LUMPS - 1), (lump) => {
    const angle = lump * GOLDEN + hashUnit(tree, lump);
    const ring = Math.sqrt((lump + 0.5) / CROWN_LUMPS);
    const spread = 4.3 * ring * (0.82 + 0.3 * hashUnit(lump, tree + 7));
    return {
      color: LEAVES[(tree + lump) % LEAVES.length],
      key: `${x}-${lump}`,
      position: [
        x + Math.cos(angle) * spread,
        6.3 - 1.9 * ring * ring + 0.55 * hashUnit(tree + 3, lump),
        ROW + Math.sin(angle) * spread,
      ] as const,
      scale: 1.25 - 0.5 * ring + 0.4 * hashUnit(lump + 11, tree),
    };
  });
}

/** The boughs of one tree: each leaves the fork and climbs outward under the crown. */
function boughsOf(x: number, tree: number) {
  return Arr.map(Arr.range(0, BOUGHS - 1), (bough) => {
    const angle = (bough / BOUGHS) * Math.PI * 2 + hashUnit(tree + 5, bough) * 1.1;
    const lean = 0.75 + 0.3 * hashUnit(bough, tree + 13);
    const reach = 1.45;
    return {
      key: `${x}-${bough}`,
      position: [
        x + Math.cos(angle) * Math.sin(lean) * reach,
        3.85 + Math.cos(lean) * reach,
        ROW + Math.sin(angle) * Math.sin(lean) * reach,
      ] as const,
      rotation: [0, -angle, -lean] as const,
    };
  });
}

/**
 * Roadside rain trees beyond the pavement: a furrowed trunk that flares
 * into its roots, boughs that fork out under the crown, and a broad
 * umbrella of leafy masses, mottled by a grain that breaks each mass into
 * leaves.
 */
export function Trees({ positions }: { readonly positions: readonly number[] }) {
  const leaves = useMemo(() => {
    const grain = grainTexture(1.7);
    grain.repeat.set(4, 3);
    return grain;
  }, []);
  useEffect(() => () => leaves.dispose(), [leaves]);
  const count = Math.max(1, positions.length);

  return (
    <group>
      <Instances castShadow limit={count} receiveShadow>
        <latheGeometry args={[TRUNK, 20]} />
        <SurfaceMaterial
          color={ROAD_COLORS.bark}
          repeat={[3, 4]}
          surface="bark"
        />
        {Arr.map(positions, (x, tree) => (
          <Instance
            key={x}
            position={[x, 0, ROW]}
            rotation={[0, tree * 2.1, 0]}
          />
        ))}
      </Instances>
      <Instances castShadow limit={count * BOUGHS}>
        <cylinderGeometry args={[0.055, 0.15, 3, 10]} />
        <SurfaceMaterial
          color={ROAD_COLORS.bark}
          repeat={[2, 3]}
          surface="bark"
        />
        {Arr.flatMap(positions, (x, tree) =>
          Arr.map(boughsOf(x, tree), (bough) => (
            <Instance
              key={bough.key}
              position={bough.position}
              rotation={bough.rotation}
            />
          ))
        )}
      </Instances>
      <Instances castShadow limit={count * CROWN_LUMPS} receiveShadow>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          bumpMap={leaves}
          bumpScale={9}
          map={leaves}
          roughness={0.85}
        />
        {Arr.flatMap(positions, (x, tree) =>
          Arr.map(crownOf(x, tree), (lump) => (
            <Instance
              color={lump.color}
              key={lump.key}
              position={lump.position}
              scale={[lump.scale, lump.scale * 0.62, lump.scale]}
            />
          ))
        )}
      </Instances>
    </group>
  );
}
