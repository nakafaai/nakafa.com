import { chanceAt } from "@repo/design-system/components/three/field/noise";
import type { Point } from "@repo/design-system/components/three/molecule/point";
import { PointSchema } from "@repo/design-system/components/three/molecule/point";
import { Array as Arr, Schema } from "effect";

/**
 * The inside of the chloroplast in the scene's units: the half lengths of
 * the inner membrane's ellipsoid along x, y and z. A real chloroplast is a
 * lens some 5 by 2 by 3 micrometres.
 */
export const LENS = [1.24, 0.47, 0.71] as const;

/** How far one thylakoid of a granum stands above the one below, and how thick each is. */
export const PITCH = 0.034;
const SAC = 0.012;

/** The rows grana stand in across the lens, and how far apart they stand along it. */
const ROWS = [-0.36, -0.12, 0.12, 0.36] as const;
const SPACING = 0.31;

/** Two grana no farther apart than this are joined by stroma lamellae. */
const NEIGHBOUR = 0.4;

/** One flattened sac of thylakoid membrane: its middle, its half lengths along x, y and z, and how far it is turned about y. */
const SacSchema = Schema.Struct({
  at: PointSchema,
  size: PointSchema,
  turn: Schema.Finite,
});
type Sac = typeof SacSchema.Type;

/** One granum: where its stack stands on the lens's middle plane, how wide its thylakoids are and how many it stacks. */
const GranumSchema = Schema.Struct({
  discs: Schema.Finite,
  radius: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
type Granum = typeof GranumSchema.Type;

/** How much of the lens's half thickness is left at (x, z): 1 at its middle, 0 at its edge and beyond. */
export function depthAt(x: number, z: number) {
  return Math.sqrt(Math.max(0, 1 - (x / LENS[0]) ** 2 - (z / LENS[2]) ** 2));
}

/**
 * The grana of one chloroplast: stacks standing in staggered rows through
 * the stroma, each a little off its row, each as tall as the lens leaves
 * room for where it stands, so the tallest stacks are in the middle. A real
 * chloroplast holds forty to sixty; the model shows the 28 that fit its
 * rows.
 */
export function granaOf(): readonly Granum[] {
  return Arr.flatMap(ROWS, (row, line) =>
    Arr.flatMap(Arr.range(-4, 4), (column) => {
      const seed = line * 16 + column + 4;
      const x =
        (column + (line % 2) / 2) * SPACING +
        (chanceAt(seed, 1, 3) - 0.5) * 0.07;
      const z = row + (chanceAt(seed, 2, 3) - 0.5) * 0.06;
      const discs = Math.min(
        14,
        Math.floor((depthAt(x, z) * LENS[1] * 1.5) / PITCH)
      );
      return discs < 4
        ? []
        : [{ discs, radius: 0.094 + chanceAt(seed, 3, 3) * 0.026, x, z }];
    })
  );
}

/**
 * Every thylakoid of every granum, a flattened sac lying on the one below:
 * none quite the size of its neighbours and none quite in line, as in an
 * electron micrograph of a granum.
 */
export function thylakoidsOf(grana: readonly Granum[]): readonly Sac[] {
  return Arr.flatMap(grana, (granum, stack) =>
    Arr.makeBy(granum.discs, (disc) => {
      const seed = stack * 32 + disc;
      const radius = granum.radius * (0.9 + chanceAt(seed, 4, 5) * 0.16);
      return {
        at: [
          granum.x + (chanceAt(seed, 5, 5) - 0.5) * 0.014,
          (disc - (granum.discs - 1) / 2) * PITCH,
          granum.z + (chanceAt(seed, 6, 5) - 0.5) * 0.014,
        ] as const,
        size: [radius, SAC, radius] as const,
        turn: chanceAt(seed, 7, 5) * Math.PI * 2,
      };
    })
  );
}

/**
 * The stroma lamellae: long flat thylakoids that run through the stroma from
 * one granum to its neighbour and join their inner spaces, at every third
 * level of the shorter stack.
 */
export function lamellaeOf(grana: readonly Granum[]): readonly Sac[] {
  return Arr.flatMap(grana, (from, index) =>
    Arr.flatMap(Arr.drop(grana, index + 1), (to) => {
      const span = Math.hypot(to.x - from.x, to.z - from.z);
      if (span > NEIGHBOUR) {
        return [];
      }
      const levels = Math.floor(Math.min(from.discs, to.discs) / 3);
      return Arr.makeBy(levels, (level) => ({
        at: [
          (from.x + to.x) / 2,
          (level - (levels - 1) / 2) * PITCH * 3,
          (from.z + to.z) / 2,
        ] as const,
        size: [span / 2, SAC * 0.8, 0.036 + (level % 2) * 0.014] as const,
        turn: -Math.atan2(to.z - from.z, to.x - from.x),
      }));
    })
  );
}

/**
 * The edge of the cutaway, as directions from the lens's middle: the top
 * front quarter of the envelope is cut off, so the edge runs round the front
 * of the middle plane and back over the top along the lens's length.
 */
export function rimOf(samples: number): readonly Point[] {
  return Arr.makeBy(samples * 2, (index) => {
    const angle = ((index % samples) / samples) * Math.PI;
    return index < samples
      ? ([Math.cos(angle), 0, Math.sin(angle)] as const)
      : ([-Math.cos(angle), Math.sin(angle), 0] as const);
  });
}

/**
 * Where the small bodies of the stroma float, `count` of them: scattered
 * through the lower half of the lens, clear of its membrane, the same on
 * every device.
 */
export function specksOf(count: number, seed: number): readonly Point[] {
  return Arr.makeBy(count, (index) => {
    const reach = Math.sqrt(chanceAt(index, 1, seed)) * 0.88;
    const around = chanceAt(index, 2, seed) * Math.PI * 2;
    const x = Math.cos(around) * reach * LENS[0];
    const z = Math.sin(around) * reach * LENS[2];
    const room = depthAt(x, z) * LENS[1] * 0.85;
    return [x, -room * (0.15 + chanceAt(index, 3, seed) * 0.8), z] as const;
  });
}
