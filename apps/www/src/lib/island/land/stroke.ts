import { Array as Arr, Option, Schema } from "effect";
import type { Change } from "@/lib/island/land/changes";
import { pointTo } from "@/lib/island/land/changes";
import { CHUNK, indexOf, LIFT_STEPS, PAINT } from "@/lib/island/land/chunk";
import { LIFT_LIMIT, liftOf, paintOf } from "@/lib/island/land/edits";
import { floraOf } from "@/lib/island/land/flora";
import type { Land } from "@/lib/island/land/ground";
import { chunkOver, heightAt } from "@/lib/island/land/ground";
import { ease } from "@/lib/island/land/relief";

/**
 * The brushes that change the land itself (ADR 0050, W2): the surfaces a
 * learner paints, the ones that raise, lower and level the ground, a pond,
 * and the one that clears wild plants.
 */
export const Brush = Schema.Literals([
  "path",
  "meadow",
  "sand",
  "grass",
  "raise",
  "lower",
  "level",
  "pond",
  "clear",
]);
export type Brush = typeof Brush.Type;

/** How wide each brush reaches from its middle, in blocks: a path is narrow, a clearing a little wider, the rest broad. */
const REACH = { clear: 1.8, path: 1.1 } as const;
const BROAD = 2.1;

/** How far the middle of a raising or lowering dab moves the ground, in eighths of a block. */
const DAB = 2.56;

/** The share of the way to the level a levelling dab moves the ground at its middle. */
const LEVELLING = 0.35;

/** The surface each painting brush lays. */
const SURFACE = {
  grass: PAINT.grass,
  meadow: PAINT.meadow,
  path: PAINT.path,
  pond: PAINT.pond,
  sand: PAINT.sand,
} as const;

/** How wide a brush reaches. */
export function reachOf(brush: Brush) {
  if (brush === "path" || brush === "clear") {
    return REACH[brush];
  }
  return BROAD;
}

/** The lattice points a dab of a reach covers about a place, each with how strongly the dab falls on it, from 1 at the middle to 0 at its rim. */
function dabOf(x: number, z: number, reach: number) {
  const side = Math.ceil(z + reach) - Math.floor(z - reach) + 1;
  const wide = Math.ceil(x + reach) - Math.floor(x - reach) + 1;
  return Arr.filter(
    Arr.makeBy(side * wide, (slot) => {
      const i = Math.floor(x - reach) + (slot % wide);
      const j = Math.floor(z - reach) + Math.floor(slot / wide);
      const away = Math.hypot(i - x, j - z);
      return { away, fall: 1 - ease(reach * 0.3, reach, away), i, j };
    }),
    (point) => point.away <= reach
  );
}

/** Whether the land's own water stands over a lattice point: a river, a lake or the sea, and not a pond the learner dug, which a surface painted over it fills in again. */
function isWet(land: Land, i: number, j: number) {
  const chunk = chunkOver(land, i, j);
  const index = indexOf(i, j);
  return (
    paintOf(land, i, j) !== PAINT.pond &&
    chunk.surfaces[index] > chunk.heights[index]
  );
}

/** How far a dab moves one point's stored lift, in whole eighths. */
function moveOf(brush: Brush, fall: number, short: number) {
  if (brush === "raise") {
    return Math.round(DAB * fall);
  }
  if (brush === "lower") {
    return -Math.round(DAB * fall);
  }
  const wanted = short * LIFT_STEPS * LEVELLING * fall;
  // A point within an eighth of the level takes the last step whole, so levelling ends flat and not almost flat.
  return Math.abs(wanted) < 1 && Math.abs(short * LIFT_STEPS) >= 1 && fall > 0.5
    ? Math.sign(short)
    : Math.round(wanted);
}

/**
 * The changes one dab of a brush makes about a place (ADR 0050, W2). `level`
 * is the height the stroke began at, which the levelling brush brings the
 * ground to. The land's own water is never painted over, a pond is dug only
 * in dry ground, and a surface painted over a pond fills it in.
 */
export function dabChanges(
  land: Land,
  brush: Brush,
  x: number,
  z: number,
  level: number
): readonly Change[] {
  const points = dabOf(x, z, reachOf(brush));
  if (brush === "clear") {
    const rooted = Arr.flatMap(
      Arr.dedupe(
        Arr.map(
          points,
          (point) =>
            [Math.floor(point.i / CHUNK), Math.floor(point.j / CHUNK)] as const
        )
      ),
      ([cx, cz]) => floraOf(land, cx, cz)
    );
    return Arr.getSomes(
      Arr.map(
        Arr.filter(
          rooted,
          (plant) => Math.hypot(plant.x - x, plant.z - z) <= REACH.clear
        ),
        (plant) => pointTo(land, "clear", plant.i, plant.j, 1)
      )
    );
  }
  if (brush === "raise" || brush === "lower" || brush === "level") {
    return Arr.getSomes(
      Arr.map(points, (point) => {
        const held = liftOf(land, point.i, point.j);
        const moved = moveOf(
          brush,
          point.fall,
          level - heightAt(land, point.i, point.j)
        );
        return pointTo(
          land,
          "lift",
          point.i,
          point.j,
          Math.min(LIFT_LIMIT, Math.max(-LIFT_LIMIT, held + moved))
        );
      })
    );
  }
  return Arr.getSomes(
    Arr.map(points, (point) =>
      isWet(land, point.i, point.j)
        ? Option.none()
        : pointTo(land, "paint", point.i, point.j, SURFACE[brush])
    )
  );
}

/**
 * The changes that level the ground under a building (ADR 0050, W2): every
 * lattice point inside the rectangle comes to the mean height of the points
 * it holds, and the points one block outside come halfway, so the building
 * stands on a terrace that eases into the land.
 */
export function levelChanges(
  land: Land,
  from: readonly [number, number],
  to: readonly [number, number]
): readonly Change[] {
  const wide = Math.ceil(to[0]) - Math.floor(from[0]) + 3;
  const deep = Math.ceil(to[1]) - Math.floor(from[1]) + 3;
  const points = Arr.makeBy(wide * deep, (slot) => {
    const i = Math.floor(from[0]) - 1 + (slot % wide);
    const j = Math.floor(from[1]) - 1 + Math.floor(slot / wide);
    return {
      height: heightAt(land, i, j),
      i,
      inside: i >= from[0] && i <= to[0] && j >= from[1] && j <= to[1],
      j,
    };
  });
  const inside = Arr.filter(points, (point) => point.inside);
  const mean =
    inside.length === 0
      ? heightAt(land, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2)
      : Arr.reduce(inside, 0, (sum, point) => sum + point.height) /
        inside.length;
  return Arr.getSomes(
    Arr.map(points, (point) =>
      pointTo(
        land,
        "lift",
        point.i,
        point.j,
        Math.min(
          LIFT_LIMIT,
          Math.max(
            -LIFT_LIMIT,
            liftOf(land, point.i, point.j) +
              Math.round(
                (mean - point.height) * (point.inside ? 1 : 0.5) * LIFT_STEPS
              )
          )
        )
      )
    )
  );
}
