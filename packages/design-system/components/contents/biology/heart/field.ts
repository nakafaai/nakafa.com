/**
 * The specimen as one signed distance field, in centimetres, built from the
 * parts the anatomy module sizes: the outer skin of the heart and its
 * vessels, the blood spaces inside them, the muscle that stands in the
 * ventricles, and the dissection cut that opens it all from the front. A
 * negative distance lies inside the tissue.
 */

import type {
  Ellipsoid,
  Path,
  Point,
} from "@repo/design-system/components/contents/biology/heart/anatomy";
import {
  ACROSS,
  AORTA,
  ARTERIAL_WALL,
  ATRIAL_WALL,
  AXIS,
  BASE,
  BRANCHES,
  INFERIOR_CAVA,
  LEFT_ATRIUM,
  LEFT_CAVITY,
  LEFT_OUTFLOW,
  LEFT_PULMONARY,
  LEFT_WALL,
  MERGE,
  MITRAL,
  MODERATOR,
  PAPILLARY,
  PAPILLARY_RADII,
  PULMONARY,
  PULMONARY_VEINS,
  RIGHT_ATRIUM,
  RIGHT_CAVITY,
  RIGHT_PULMONARY,
  RIGHT_WALL,
  SUPERIOR_CAVA,
  TRICUSPID,
  VENOUS_WALL,
} from "@repo/design-system/components/contents/biology/heart/anatomy";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Record } from "effect";

/** The polynomial smooth minimum of two distances (Quilez), merging them over `soft`. */
function smooth(a: number, b: number, soft: number) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / soft));
  return b + (a - b) * h - soft * h * (1 - h);
}

/** The approximate signed distance to an ellipsoid in the heart's frame, grown by `grow` (Quilez). */
function ellipsoid(
  x: number,
  y: number,
  z: number,
  shape: Ellipsoid,
  grow: number
) {
  const along = x * AXIS[0] + y * AXIS[1] - shape.along;
  const across = x * ACROSS[0] + y * ACROSS[1] - shape.across;
  const depth = z - shape.depth;
  const a = shape.radii[0] + grow;
  const b = shape.radii[1] + grow;
  const c = shape.radii[2] + grow;
  const k0 = Math.sqrt((along / a) ** 2 + (across / b) ** 2 + (depth / c) ** 2);
  const k1 = Math.sqrt(
    (along / (a * a)) ** 2 + (across / (b * b)) ** 2 + (depth / (c * c)) ** 2
  );
  return (k0 * (k0 - 1)) / Math.max(k1, 1e-9);
}

/** How many numbers describe one segment of a prepared tube. */
const STRIDE = 9;

/**
 * A path prepared for fast distance queries: each segment's start, start
 * radius, direction, change of radius and inverse squared length, and the
 * box round the whole path, grown by its widest radius and `grow`.
 */
function prepare(path: Path, grow: number) {
  const segments = new Float64Array((path.length - 1) * STRIDE);
  Arr.forEach(Arr.zip(path, Arr.drop(path, 1)), ([from, to], index) => {
    const ex = to[0] - from[0];
    const ey = to[1] - from[1];
    const ez = to[2] - from[2];
    segments.set(
      [
        from[0],
        from[1],
        from[2],
        from[3],
        ex,
        ey,
        ez,
        to[3] - from[3],
        1 / (ex * ex + ey * ey + ez * ez),
      ],
      index * STRIDE
    );
  });
  const reach = Math.max(...Arr.map(path, (point) => point[3])) + grow + 1;
  const axis = (index: 0 | 1 | 2) => Arr.map(path, (point) => point[index]);
  return {
    box: [
      Math.min(...axis(0)) - reach,
      Math.min(...axis(1)) - reach,
      Math.min(...axis(2)) - reach,
      Math.max(...axis(0)) + reach,
      Math.max(...axis(1)) + reach,
      Math.max(...axis(2)) + reach,
    ] as const,
    segments,
  };
}
type Tube = ReturnType<typeof prepare>;

/** How far a point lies outside a tube's box, 0 inside it: never more than its distance to the tube. */
function outside(x: number, y: number, z: number, { box }: Tube) {
  const dx = Math.max(box[0] - x, 0, x - box[3]);
  const dy = Math.max(box[1] - y, 0, y - box[4]);
  const dz = Math.max(box[2] - z, 0, z - box[5]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * The signed distance to a tube, its radius grown by `grow`. With `capped`,
 * it stops flat at its last point, as a vessel cut across does; otherwise it
 * runs on a quarter of its last segment, so a lumen opens through the cut.
 */
function tube(
  x: number,
  y: number,
  z: number,
  { segments }: Tube,
  grow: number,
  capped: boolean
) {
  let nearest = Number.POSITIVE_INFINITY;
  const last = segments.length - STRIDE;
  for (let at = 0; at <= last; at += STRIDE) {
    const ax = segments[at];
    const ay = segments[at + 1];
    const az = segments[at + 2];
    const ex = segments[at + 4];
    const ey = segments[at + 5];
    const ez = segments[at + 6];
    const inverse = segments[at + 8];
    const along = ((x - ax) * ex + (y - ay) * ey + (z - az) * ez) * inverse;
    const t = Math.max(0, Math.min(at === last && !capped ? 1.25 : 1, along));
    const dx = x - ax - t * ex;
    const dy = y - ay - t * ey;
    const dz = z - az - t * ez;
    const radius = segments[at + 3] + segments[at + 7] * Math.min(1, t) + grow;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) - radius;
    const cap =
      at === last && capped
        ? (along - 1) / Math.sqrt(inverse)
        : Number.NEGATIVE_INFINITY;
    nearest = Math.min(nearest, Math.max(distance, cap));
  }
  return nearest;
}

/** The arteries and veins that leave or reach the heart, prepared, each with its wall thickness. */
const VESSELS = Arr.map(
  [
    [AORTA, ARTERIAL_WALL],
    [PULMONARY, ARTERIAL_WALL],
    [LEFT_PULMONARY, ARTERIAL_WALL],
    [RIGHT_PULMONARY, ARTERIAL_WALL],
    ...Arr.map(BRANCHES, (branch) => [branch, ARTERIAL_WALL] as const),
    [SUPERIOR_CAVA, VENOUS_WALL],
    [INFERIOR_CAVA, VENOUS_WALL],
    ...Arr.map(PULMONARY_VEINS, (vein) => [vein, VENOUS_WALL] as const),
  ] as const,
  ([path, wall]) => ({ tube: prepare(path, wall), wall })
);

/**
 * The distance from a point to the outer wall of the nearest artery (the
 * aorta, the pulmonary trunk and their branches, whose walls are thick,
 * elastic and pale) or vein (the venae cavae and pulmonary veins, whose walls
 * are thin and dark).
 */
export function vesselField(
  x: number,
  y: number,
  z: number,
  kind: "artery" | "vein"
) {
  const wall = kind === "artery" ? ARTERIAL_WALL : VENOUS_WALL;
  let nearest = 100;
  for (const vessel of VESSELS) {
    if (vessel.wall === wall) {
      nearest = Math.min(
        nearest,
        tube(x, y, z, vessel.tube, vessel.wall, true)
      );
    }
  }
  return nearest;
}

/**
 * How deep a point lies in one of the grooves of the heart's surface, from
 * 0 (none) to 1: the coronary sulcus between the atria and the ventricles,
 * and the interventricular sulcus between the two ventricles, where fat and
 * the coronary vessels lie (OpenStax 19.1).
 */
export function grooveDepth(x: number, y: number, z: number) {
  const left = ellipsoid(x, y, z, LEFT_WALL, 0);
  const right = ellipsoid(x, y, z, RIGHT_CAVITY, RIGHT_WALL);
  const atria = Math.min(
    ellipsoid(x, y, z, RIGHT_ATRIUM, ATRIAL_WALL),
    ellipsoid(x, y, z, LEFT_ATRIUM, ATRIAL_WALL)
  );
  const crease = Math.min(
    Math.abs(Math.min(left, right) - atria),
    Math.abs(left - right)
  );
  return Math.max(0, 1 - crease / 0.9);
}

/** The left ventricle's outflow, prepared. */
const OUTFLOW = prepare(LEFT_OUTFLOW, 0);

/** The papillary muscles and the moderator band, prepared. */
const MUSCLES = [
  prepare(MODERATOR, 0),
  ...Arr.map(Record.values(PAPILLARY), ({ root, tip }) =>
    prepare(
      [
        [...root, PAPILLARY_RADII[0]],
        [...tip, PAPILLARY_RADII[1]],
      ],
      0
    )
  ),
];

/** The outer skin of the heart and its vessels, before it is cut open. */
export function outerField(x: number, y: number, z: number) {
  let skin = ellipsoid(x, y, z, LEFT_WALL, 0);
  skin = smooth(skin, ellipsoid(x, y, z, BASE, 0), MERGE);
  skin = smooth(skin, ellipsoid(x, y, z, RIGHT_CAVITY, RIGHT_WALL), MERGE);
  skin = smooth(skin, ellipsoid(x, y, z, RIGHT_ATRIUM, ATRIAL_WALL), MERGE);
  skin = smooth(skin, ellipsoid(x, y, z, LEFT_ATRIUM, ATRIAL_WALL), MERGE);
  for (const vessel of VESSELS) {
    if (outside(x, y, z, vessel.tube) < skin + MERGE) {
      skin = smooth(
        skin,
        tube(x, y, z, vessel.tube, vessel.wall, true),
        MERGE * 0.5
      );
    }
  }
  return skin;
}

/** The distance to an atrioventricular orifice: a short drum through the valve plane. */
function orifice(
  x: number,
  y: number,
  z: number,
  ring: { across: number; along: number; depth: number; radius: number }
) {
  const along = x * AXIS[0] + y * AXIS[1] - ring.along;
  const across = x * ACROSS[0] + y * ACROSS[1] - ring.across;
  const radial =
    Math.sqrt(across * across + (z - ring.depth) ** 2) - ring.radius;
  return Math.max(radial, Math.abs(along) - 0.9);
}

/** The blood spaces: the chambers, their orifices and outflows, and the lumens of the vessels. */
export function cavityField(x: number, y: number, z: number) {
  const right = Math.max(
    ellipsoid(x, y, z, RIGHT_CAVITY, 0),
    -ellipsoid(x, y, z, LEFT_WALL, 0)
  );
  let space = Math.min(ellipsoid(x, y, z, LEFT_CAVITY, 0), right);
  space = Math.min(space, ellipsoid(x, y, z, RIGHT_ATRIUM, 0));
  space = Math.min(space, ellipsoid(x, y, z, LEFT_ATRIUM, 0));
  space = Math.min(space, orifice(x, y, z, MITRAL));
  space = Math.min(space, orifice(x, y, z, TRICUSPID));
  space = Math.min(space, tube(x, y, z, OUTFLOW, 0, true));
  for (const vessel of VESSELS) {
    if (outside(x, y, z, vessel.tube) < space) {
      space = Math.min(space, tube(x, y, z, vessel.tube, 0, false));
    }
  }
  return space;
}

/** The muscle that stands inside the ventricles: papillary muscles and the moderator band. */
function innerMuscle(x: number, y: number, z: number) {
  // Far beyond the box, but finite, so the smooth minimum stays a number.
  let muscle = 100;
  for (const rod of MUSCLES) {
    if (outside(x, y, z, rod) < muscle + 0.3) {
      muscle = smooth(muscle, tube(x, y, z, rod, 0, true), 0.3);
    }
  }
  return muscle;
}

/**
 * The ridges of muscle (trabeculae carneae) that line the ventricles, most
 * pronounced toward the apex: they shallow the cavity by up to 0.22 cm.
 */
function trabeculae(x: number, y: number, z: number) {
  const along = x * AXIS[0] + y * AXIS[1];
  if (along < 1.2) {
    return 0;
  }
  const across = x * ACROSS[0] + y * ACROSS[1];
  const ridge =
    valueNoise(across * 2.6 + z * 1.3, along * 0.55, 64) * 0.6 +
    valueNoise(z * 2.6 - across * 0.9, along * 0.7 + 7, 64) * 0.4;
  const depth = 0.22 * Math.min(1, (along - 1.2) / 3);
  return depth * Math.max(0, ridge - 0.42) * 2.2;
}

/**
 * Where the dissection cut runs: the depth z below which the heart is kept.
 * It passes through the middle of the chambers, rises through the right
 * ventricle's outflow to open the pulmonary trunk, dips to open the left
 * atrium further back, and leaves the arch and its branches whole.
 */
export function cutDepth(x: number, y: number) {
  const trunk = Math.max(0, Math.min(1, (y - 2.6) / 1.4));
  const middle = 0.8 + 0.4 * trunk;
  const height = 2.1 - 1.1 * trunk - 0.25;
  const window =
    Math.max(0, Math.min(1, (y - 1.75) / 0.5)) *
    Math.exp(-((x - middle) ** 2) / 1.4);
  const atrium = Math.exp(-((x - 2.9) ** 2 + (y - 2.8) ** 2) / 2.2);
  const above = Math.max(0, Math.min(1, (y - 4.4) / 1.2));
  return 0.25 + height * window - 1.1 * atrium * (1 - window) + 6 * above;
}

/**
 * The finished specimen: muscle and vessel walls, cut open from the front.
 * A point in front of the cut, or outside the outer skin, is outside the
 * specimen by at least that much, so the rest is measured only near it.
 */
export function heartField(x: number, y: number, z: number) {
  const front = z - cutDepth(x, y);
  if (front > 0.6) {
    return front;
  }
  const outer = outerField(x, y, z);
  if (outer > 0.3) {
    return Math.max(outer, front);
  }
  const cavity = cavityField(x, y, z);
  const lining = cavity < 0.5 && cavity > -0.5 ? trabeculae(x, y, z) : 0;
  const wall = Math.max(outer, -(cavity + lining));
  return Math.max(Math.min(wall, innerMuscle(x, y, z)), front);
}

/** The box that holds the specimen, with a margin, as lowest and highest corners. */
const HIGHEST: Point = [6.6, 11.4, 4.0];
const LOWEST: Point = [-6.0, -8.2, -5.9];
export const BOUNDS = { high: HIGHEST, low: LOWEST };
