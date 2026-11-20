import { Array as Arr, Result } from "effect";

/**
 * The layout of a small fascicle of skeletal muscle fibres in cross-section,
 * in scene units of 10 µm. Fibres run along x; this module works in the
 * cross-section plane, written as (y, z).
 *
 * Seven fibres pack as cells of a honeycomb, rounded at their corners, with
 * the endomysium between them, and a capillary sits at each corner where
 * three fibres meet and in each groove between two outer fibres, as cross
 * sections of muscle show them.
 */

/** A point of the cross-section, (y, z) in scene units. */
type Point = readonly [number, number];

/** Micrometres in one scene unit. */
export const MICRONS = 10;

/** How long the fibres run in the scene, in scene units: 400 µm of fibres that may be centimetres long. */
export const LENGTH = 40;

/** Where the front cut across the fascicle lies, in scene units along the fibres; the back cut lies at minus this. */
export const FRONT = LENGTH / 2;

/**
 * The distance between neighbouring fibre centres, in scene units. A human
 * vastus lateralis fibre has a cross-section of about 4,300 to 4,500 µm²
 * (type I fibres, 4267 µm² in women and 4490 µm² in men; Roepstorff et al.
 * 2006, J Physiol, https://pmc.ncbi.nlm.nih.gov/articles/PMC1817798/table/tbl4),
 * about 75 µm across, inside the 10 to 100 µm range of OpenStax Anatomy and
 * Physiology 2e, 10.2. Honeycomb cells of 4,500 µm² sit √(2A/√3) ≈ 72 µm
 * apart.
 */
export const SPACING = 7.2;

/** Half the endomysium between two fibres, in scene units (0.6 µm). */
const SEAM = 0.06;

/** The radius of an outer fibre where no neighbour flattens it, in scene units. */
const ROUND = 4.1;

/** How softly a fibre's sides meet at its corners, in scene units. */
const SOFT = 0.25;

/** How softly a fibre's surface turns into the hollow a capillary presses into it, in scene units. */
const BITE = 0.12;

/**
 * The radius of a capillary's lumen, in scene units: 8 µm across, inside the
 * 5 to 10 µm of OpenStax Anatomy and Physiology 2e, 20.1. A red blood cell of
 * about 7.8 µm then passes only by folding a little.
 */
export const LUMEN = 0.4;

/** The capillary wall, endothelium over its basement membrane, in scene units (0.5 µm). */
export const WALL = 0.05;

/** The least gap the lab keeps between a capillary wall and a fibre, in scene units (0.5 µm). */
const MARGIN = 0.05;

/** The clearance a capillary needs round its centre: lumen, wall, and the least gap to a fibre. */
export const CLEARANCE = LUMEN + WALL + MARGIN;

/**
 * The fibre centres: one in the middle and six round it, the first on top
 * and the rest every 60 degrees towards the front.
 */
export const CENTRES: readonly Point[] = [
  [0, 0],
  ...Arr.map(Arr.range(0, 5), (index): Point => {
    const angle = (index * Math.PI) / 3;
    return [SPACING * Math.cos(angle), SPACING * Math.sin(angle)];
  }),
];

/** The direction of `angle` in the cross-section, measured from +y towards +z. */
function along(angle: number): Point {
  return [Math.cos(angle), Math.sin(angle)];
}

/**
 * How far from the fascicle's axis the groove between two outer fibres
 * closes, in scene units: where the round outlines of the two fibres cross
 * the plane between them.
 */
const GROOVE =
  SPACING * Math.cos(Math.PI / 6) +
  Math.sqrt(ROUND ** 2 - (SPACING * Math.sin(Math.PI / 6)) ** 2);

/**
 * Where the capillaries run, as points of the cross-section: six at the
 * corners where the middle fibre meets two outer ones, and six in the
 * grooves between neighbouring outer fibres, sunk into the groove. Twelve
 * capillaries for seven fibres is about two a fibre, as in human vastus
 * lateralis (capillary-to-fibre ratio 1.9 to 2.1; Zoladz et al. 2005, Folia
 * Histochem Cytobiol 43:11). Each presses a shallow hollow into the fibres
 * round it, as capillaries do at fibre corners.
 */
export const CAPILLARIES: readonly Point[] = Arr.flatMap(
  Arr.range(0, 5),
  (index) => {
    const [dy, dz] = along(((index + 0.5) * Math.PI) / 3);
    const corner = SPACING / Math.sqrt(3);
    const groove = GROOVE + LUMEN * 0.3;
    return [
      [dy * corner, dz * corner],
      [dy * groove, dz * groove],
    ];
  }
);

/** The smaller of `a` and `b`, blended over `soft` where they are close, as a polynomial smooth minimum. */
function blend(a: number, b: number, soft: number) {
  const near = Math.max(soft - Math.abs(a - b), 0) / soft;
  return Math.min(a, b) - (near * near * soft) / 4;
}

/**
 * How far along the ray from `centre` in direction `angle` the clearance
 * round `capillary` begins, or infinity when the ray misses it.
 */
function hollow(centre: Point, angle: number, capillary: Point) {
  const [dy, dz] = along(angle);
  const y = capillary[0] - centre[0];
  const z = capillary[1] - centre[1];
  const facing = dy * y + dz * z;
  const square = facing * facing - (y * y + z * z - CLEARANCE * CLEARANCE);
  return facing <= 0 || square < 0
    ? Number.POSITIVE_INFINITY
    : facing - Math.sqrt(square);
}

/**
 * How far the surface of the fibre centred at `centre` lies from that centre
 * in the direction `angle`, in scene units: the nearest of the planes halfway
 * to each neighbour, less half the endomysium, and its own round outline,
 * blended so the corners are soft, then hollowed where a capillary presses in.
 */
export function reach(centre: Point, angle: number) {
  const [dy, dz] = along(angle);
  const limits = Arr.filterMap(CENTRES, (other) => {
    const y = other[0] - centre[0];
    const z = other[1] - centre[1];
    const apart = Math.hypot(y, z);
    const facing = (dy * y + dz * z) / apart;
    return apart < 1e-9 || apart > SPACING * 1.5 || facing <= 0
      ? Result.failVoid
      : Result.succeed((apart / 2 - SEAM) / facing);
  });
  const total = Arr.reduce(
    limits,
    Math.exp(-ROUND / SOFT),
    (sum, limit) => sum + Math.exp(-limit / SOFT)
  );
  const sides = -SOFT * Math.log(total);
  return Arr.reduce(CAPILLARIES, sides, (surface, capillary) =>
    blend(surface, hollow(centre, angle, capillary), BITE)
  );
}

/** The outline of the fibre centred at `centre` at `count` evenly spaced angles, as points of the cross-section. */
export function outline(centre: Point, count: number) {
  return Arr.map(Arr.range(0, count - 1), (step): Point => {
    const angle = (step / count) * Math.PI * 2;
    const [dy, dz] = along(angle);
    const radius = reach(centre, angle);
    return [centre[0] + dy * radius, centre[1] + dz * radius];
  });
}

/**
 * How far `point` lies outside the nearest fibre, measured along the line
 * from that fibre's centre, in scene units. It is negative inside a fibre.
 */
export function gap(point: Point) {
  return Arr.reduce(CENTRES, Number.POSITIVE_INFINITY, (least, centre) => {
    const y = point[0] - centre[0];
    const z = point[1] - centre[1];
    return Math.min(least, Math.hypot(y, z) - reach(centre, Math.atan2(z, y)));
  });
}

/** Every fibre's outline at 96 points, traced once for `hull`. */
const RIM = Arr.flatMap(CENTRES, (centre) => outline(centre, 96));

/**
 * How far the fascicle reaches from its axis in the direction `angle`, in
 * scene units: the support of every fibre and capillary in that direction,
 * which a sheath laid round the bundle never cuts into.
 */
export function hull(angle: number) {
  const [dy, dz] = along(angle);
  const fibreReach = Arr.reduce(RIM, 0, (most, [y, z]) =>
    Math.max(most, y * dy + z * dz)
  );
  return Arr.reduce(CAPILLARIES, fibreReach, (most, [y, z]) =>
    Math.max(most, y * dy + z * dz + LUMEN + WALL)
  );
}

/** The area enclosed by `points` in order, by the shoelace formula, in square scene units. */
export function area(points: readonly Point[]) {
  const next = [...Arr.drop(points, 1), ...Arr.take(points, 1)];
  const twice = Arr.reduce(
    Arr.zip(points, next),
    0,
    (sum, [[y, z], [nextY, nextZ]]) => sum + y * nextZ - nextY * z
  );
  return Math.abs(twice / 2);
}
