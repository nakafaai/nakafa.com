import { Array as Arr, Schema } from "effect";
import { CatmullRomCurve3, Vector3 } from "three";

/**
 * The vessels of the capillary bed the lab draws, in scene units of 10
 * micrometres, so a red cell is 0.78 units across. Every width is to scale;
 * the capillaries are drawn about a fifth of their real length, which
 * reaches about 1 millimetre (Guyton and Hall, 13th ed., Chapter 16), so the
 * whole bed fits one view. The tissue cells between them are in `cells`.
 */

/** Micrometres in one scene unit. */
export const MICRONS = 10;

/** A point of the bed, in scene units: x across, y up from the tissue floor, z toward the reader. */
const PointSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
export type Point = typeof PointSchema.Type;

/** A vessel's lumen width and wall thickness, in micrometres. */
const BoreSchema = Schema.Struct({ lumen: Schema.Finite, wall: Schema.Finite });
type Bore = typeof BoreSchema.Type;

/**
 * A true capillary: a lumen 6 micrometres across, inside the 5 to 10 of
 * OpenStax Anatomy and Physiology 2e, 20.1, and narrower than a red cell, so
 * red cells pass in single file and bend to fit; a wall one endothelial cell
 * thick, about 0.5 micrometre (Guyton and Hall, 13th ed., Chapter 16).
 */
export const CAPILLARY: Bore = { lumen: 6, wall: 0.5 };

/**
 * A terminal arteriole: a lumen of about 20 micrometres (Guyton and Hall,
 * 13th ed., Chapter 16) and a muscular wall whose lumen is about 1.5 times
 * its thickness (Burton, "Relation of structure to function of the tissues
 * of the wall of blood vessels", Physiological Reviews 34, 1954, 619-642).
 */
export const ARTERIOLE: Bore = { lumen: 20, wall: 20 / 1.5 };

/**
 * A venule: a lumen of 30 micrometres, inside the 8 to 100 of OpenStax
 * Anatomy and Physiology 2e, 20.1, and a thin wall whose lumen is about ten
 * times its thickness (Burton, 1954).
 */
export const VENULE: Bore = { lumen: 30, wall: 3 };

/**
 * A lymph capillary: about 50 micrometres across, as in human skin, where
 * they measure 54.8 ± 8.2 micrometres (Fischer and others, "Flow velocity of
 * single lymphatic capillaries in human skin", American Journal of
 * Physiology 270, 1996, H358-H363), with a wall of single overlapping
 * endothelial cells as thin as a blood capillary's (OpenStax Anatomy and
 * Physiology 2e, 21.1).
 */
export const LYMPH: Bore = { lumen: 50, wall: 0.5 };

/** The outer radius of a vessel, in scene units. */
export function outer(bore: Bore) {
  return (bore.lumen / 2 + bore.wall) / MICRONS;
}

/** The radius of a vessel's lumen, in scene units. */
export function inner(bore: Bore) {
  return bore.lumen / 2 / MICRONS;
}

/** The bed's footprint on the tissue floor, in scene units. */
export const BLOCK = { back: -11, front: 8, left: -10, right: 10 } as const;

/** How deep the tissue under the vessels is cut, in scene units. */
export const FLOOR = 2.4;

/** The height of a capillary's axis: it rests on the tissue floor. */
const RISE = (CAPILLARY.lumen / 2 + CAPILLARY.wall) / MICRONS;

/** Where a vessel of `bore` rests on the tissue floor: its axis is one outer radius up. */
function resting(bore: Bore, x: number, z: number): Point {
  return [x, outer(bore), z];
}

/**
 * The arteriole, from where the block's front face cuts it to its tip, where
 * it narrows into the last capillary. Its radius along it is
 * `arterioleRadius`, and it rests on the tissue floor all the way, so the
 * drawing sets its height from that radius.
 */
export const ARTERIOLE_PATH: readonly Point[] = [
  resting(ARTERIOLE, -7.2, BLOCK.front),
  resting(ARTERIOLE, -7.3, 4.8),
  resting(ARTERIOLE, -7.0, 1.6),
  resting(ARTERIOLE, -6.5, -1.6),
  [-5.7, 0.9, -3.75],
  [-4.8, RISE, -4.3],
];

/** How far along the arteriole it starts to narrow, as a share of its length. */
export const TAPER = 0.72;

/**
 * The venule, from its start, where the last capillary widens into it, to
 * where the block's front face cuts it. Like the arteriole it rests on the
 * floor, its height set from `venuleRadius`.
 */
export const VENULE_PATH: readonly Point[] = [
  [5.0, RISE, -4.45],
  [5.9, 0.9, -3.8],
  resting(VENULE, 6.4, -2.0),
  resting(VENULE, 6.9, 1.8),
  resting(VENULE, 7.1, 5.0),
  resting(VENULE, 7.2, BLOCK.front),
];

/** How far along the venule it reaches its full width, as a share of its length. */
const WIDEN = 0.24;

/** A capillary, named for where it runs, and the points its axis passes through. */
const CapillarySchema = Schema.Struct({
  name: Schema.String,
  path: Schema.Array(PointSchema),
});
type Capillary = typeof CapillarySchema.Type;

/**
 * The capillaries, each drawn from the arterial end, inside the arteriole's
 * wall, to the venous end, inside the venule's wall, winding as true
 * capillaries do. The one at the back runs on from the arteriole's tip; the
 * cross-link joins the second and the third.
 */
export const CAPILLARIES: readonly Capillary[] = [
  {
    name: "front",
    path: [
      [-6.2, RISE, 4.9],
      [-3.9, RISE, 5.4],
      [-1.3, RISE, 4.9],
      [1.4, RISE, 5.5],
      [3.9, RISE, 5.0],
      [6.3, RISE, 5.2],
    ],
  },
  {
    name: "second",
    path: [
      [-6.0, RISE, 1.7],
      [-3.4, RISE, 2.2],
      [-0.7, RISE, 1.6],
      [2.1, RISE, 2.2],
      [4.4, RISE, 1.7],
      [6.1, RISE, 1.9],
    ],
  },
  {
    name: "third",
    path: [
      [-5.6, RISE, -1.5],
      [-2.9, RISE, -1.9],
      [0.2, RISE, -1.3],
      [2.9, RISE, -1.8],
      [5.7, RISE, -1.5],
    ],
  },
  {
    name: "back",
    path: [
      [-4.8, RISE, -4.3],
      [-2.6, RISE, -4.5],
      [0.4, RISE, -4.1],
      [3.1, RISE, -4.45],
      [5.0, RISE, -4.45],
    ],
  },
  {
    name: "cross-link",
    path: [
      [-0.75, RISE, 1.6],
      [-0.35, RISE, 0.2],
      [0.25, RISE, -1.3],
    ],
  },
];

/**
 * The lymph capillary: a straight tube that begins blind among the tissue
 * cells behind the capillaries and leaves through the block's right face.
 */
export const LYMPH_PATH = {
  end: resting(LYMPH, BLOCK.right, -8.1),
  start: resting(LYMPH, -3.2, -8.1),
} as const;

/** A smooth curve through `points`. */
export function curve(points: readonly Point[]) {
  return new CatmullRomCurve3(
    Arr.map(points, (point) => new Vector3(...point)),
    false,
    "centripetal"
  );
}

/** The arteriole's radius at a share `along` its length: full, then narrowing to a capillary's at its tip, where the last capillary runs on from it. */
export function arterioleRadius(along: number) {
  const narrowing = Math.max(0, (along - TAPER) / (1 - TAPER));
  const ease = narrowing * narrowing * (3 - 2 * narrowing);
  return outer(ARTERIOLE) + (outer(CAPILLARY) - outer(ARTERIOLE)) * ease;
}

/** The venule's radius at a share `along` its length: widening from a capillary's at its start to its full width. */
export function venuleRadius(along: number) {
  const widening = Math.min(1, along / WIDEN);
  const ease = widening * widening * (3 - 2 * widening);
  return outer(CAPILLARY) + (outer(VENULE) - outer(CAPILLARY)) * ease;
}
