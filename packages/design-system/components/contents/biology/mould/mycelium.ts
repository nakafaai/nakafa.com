import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Schema } from "effect";

/** A point in the scene's frame. */
type Point = readonly [number, number, number];

/** The tray the beans lie on. */
export const TRAY = -0.32;

/**
 * Split soybean cotyledons, each a low dome with its centre, its half-length,
 * half-width and height, and how it turns about the vertical.
 */
export const BEANS = [
  { height: 0.17, length: 0.38, turn: 0.4, width: 0.28, x: -1.02, z: -0.3 },
  { height: 0.16, length: 0.35, turn: -0.5, width: 0.29, x: -0.56, z: 0.3 },
  { height: 0.18, length: 0.42, turn: 0.1, width: 0.27, x: -0.1, z: -0.2 },
  { height: 0.17, length: 0.38, turn: 0.9, width: 0.27, x: 0.38, z: 0.26 },
  { height: 0.16, length: 0.35, turn: -0.2, width: 0.3, x: 0.86, z: -0.18 },
  { height: 0.15, length: 0.33, turn: 1.4, width: 0.26, x: 0.2, z: -0.72 },
  { height: 0.15, length: 0.34, turn: -1.1, width: 0.26, x: -0.62, z: -0.78 },
] as const;

/** The height of the beans' surface above (x, z), or the tray where no bean lies. */
export function surfaceAt(x: number, z: number) {
  return Arr.reduce(BEANS, TRAY, (top, bean) => {
    const dx = x - bean.x;
    const dz = z - bean.z;
    const along = dx * Math.cos(bean.turn) + dz * Math.sin(bean.turn);
    const across = -dx * Math.sin(bean.turn) + dz * Math.cos(bean.turn);
    const inside = 1 - (along / bean.length) ** 2 - (across / bean.width) ** 2;
    return inside > 0
      ? Math.max(top, TRAY + bean.height * Math.sqrt(inside))
      : top;
  });
}

/** How far above the surface a hypha runs, so it lies on a bean and bridges the gaps between them. */
const LIFT = 0.012;

/** One hypha's run: its centre line and how thick it is. */
const BranchSchema = Schema.Struct({
  points: Schema.Array(
    Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite])
  ),
  radius: Schema.Finite,
});
export type Branch = typeof BranchSchema.Type;

/**
 * The mycelium of a Rhizopus colony: from each of `roots` germinated spores,
 * hyphae grow at their tips, wander, and fork at an angle every few steps
 * until `depth` generations have branched. A hypha follows the beans' surface
 * and sags no faster than it can bridge, so it spans the gaps between beans
 * as aerial threads do. Rhizopus hyphae are coenocytic, one long tube with
 * no cross walls.
 */
export function myceliumOf(roots: number, depth: number, seed: number) {
  const grow = (
    start: Point,
    heading: number,
    generation: number,
    salt: number
  ): readonly Branch[] => {
    const steps = 10 - generation * 2;
    const points = Arr.scan(
      Arr.range(1, steps),
      start,
      ([x, y, z], step): Point => {
        const turn = heading + (hashUnit(salt, step) - 0.5) * 0.9;
        const nx = x + Math.cos(turn) * 0.05;
        const nz = z + Math.sin(turn) * 0.05;
        const floor = surfaceAt(nx, nz) + LIFT;
        return [nx, Math.max(floor, y - 0.025), nz];
      }
    );
    const branch = { points, radius: 0.0055 - generation * 0.001 };
    if (generation >= depth) {
      return [branch];
    }
    const forks = Arr.filter(
      Arr.map(points, (point, step) => ({ point, step })),
      ({ step }) => step >= 3 && step % 3 === 0
    );
    return [
      branch,
      ...Arr.flatMap(forks, ({ point, step }) => {
        const side = hashUnit(salt, step + 50) < 0.5 ? -1 : 1;
        return grow(
          point,
          heading + side * (0.6 + hashUnit(salt, step + 70) * 0.5),
          generation + 1,
          salt * 7 + step
        );
      }),
    ];
  };
  return Arr.flatMap(Arr.range(0, roots - 1), (root) => {
    const x = (hashUnit(root, seed) - 0.5) * 1.9;
    const z = (hashUnit(root, seed + 1) - 0.5) * 0.9;
    return grow(
      [x, surfaceAt(x, z) + LIFT, z],
      hashUnit(root, seed + 2) * Math.PI * 2,
      0,
      root + seed * 31
    );
  });
}

/**
 * The tuft of rhizoids that anchors a sporangiophore: `count` short roots
 * splaying out and down from its foot into the bean, each bending once.
 */
export function rhizoidsOf(foot: Point, count: number, seed: number) {
  return Arr.map(Arr.range(0, count - 1), (index): readonly Point[] => {
    const angle = (index / count) * Math.PI * 2 + hashUnit(index, seed);
    const reach = 0.07 + hashUnit(index, seed + 1) * 0.05;
    const out = (share: number, drop: number): Point => [
      foot[0] + Math.cos(angle) * reach * share,
      foot[1] - drop,
      foot[2] + Math.sin(angle) * reach * share,
    ];
    return [foot, out(0.5, 0.012), out(1, 0.035)];
  });
}
