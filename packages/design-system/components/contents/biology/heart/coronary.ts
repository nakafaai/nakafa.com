/**
 * The coronary vessels on the heart's outer surface, which feed its own
 * muscle. They run in its grooves under the epicardial fat (OpenStax Anatomy
 * and Physiology 2e, 19.1, Figure 19.10): the right coronary artery in the
 * right atrioventricular groove, round the right margin to the back, where
 * the posterior interventricular artery runs down the posterior groove with
 * the middle cardiac vein beside it; the circumflex artery in the left
 * atrioventricular groove; and the great cardiac vein, which widens into the
 * coronary sinus along the back of that groove on its way to the right
 * atrium. Only the vessels behind the dissection cut are drawn: the front of
 * the heart, with the anterior interventricular artery, was cut away.
 *
 * The proximal right coronary artery is drawn 3.6 mm wide, within the
 * 3.9 ± 0.6 mm angiography finds in a right-dominant heart (Dodge et al.,
 * Circulation 1992;86:232-246). The circumflex and posterior
 * interventricular arteries, which feed less muscle, are drawn narrower
 * (3 and 2 mm), and the coronary sinus, the widest of them, 8.4 mm: these
 * three are proportions, not measured values.
 */

import type { Point } from "@repo/design-system/components/contents/biology/heart/anatomy";
import { place } from "@repo/design-system/components/contents/biology/heart/anatomy";
import {
  cutDepth,
  grooveDepth,
  outerField,
} from "@repo/design-system/components/contents/biology/heart/field";
import { Array as Arr } from "effect";

/** The heart's middle in its frontal section, from which rays reach its surface. */
const MIDDLE = { across: 0.3, depth: -0.6 };

/** How many steps a ray takes to find the surface: each halves the error, or better. */
const MARCH = 40;

/** Turns from degrees to radians. */
const degrees = (value: number) => (value * Math.PI) / 180;

/**
 * Where a ray from the heart's middle at `along` leaves its outer skin, the
 * ray turned `angle` radians round the long axis from the body's left
 * (0) toward the viewer (π/2), so that −π/2 points straight back. The ray
 * marches by the distance the field gives, which never passes the surface.
 */
export function surfaceAt(along: number, angle: number): Point {
  const across = Math.cos(angle);
  const depth = Math.sin(angle);
  const reach = Arr.reduce(Arr.range(1, MARCH), 0.5, (distance) => {
    const [x, y, z] = place(
      along,
      MIDDLE.across + distance * across,
      MIDDLE.depth + distance * depth
    );
    return distance - outerField(x, y, z);
  });
  return place(
    along,
    MIDDLE.across + reach * across,
    MIDDLE.depth + reach * depth
  );
}

/** Steps from `from` to `to` in `count` even steps, both ends included. */
const steps = (from: number, to: number, count: number) =>
  Arr.map(
    Arr.range(0, count - 1),
    (step) => from + ((to - from) * step) / (count - 1)
  );

/** How deep in a groove a point of the surface lies. */
const groove = (point: Point) => grooveDepth(point[0], point[1], point[2]);

/** Of `count` evenly spaced values from `from` to `to`, the one where `score` is highest. */
function best(
  from: number,
  to: number,
  count: number,
  score: (value: number) => number
) {
  const scored = Arr.map(
    steps(from, to, count),
    (value) => [value, score(value)] as const
  );
  return Arr.reduce(
    scored,
    [from, Number.NEGATIVE_INFINITY] as const,
    (kept, next) => (next[1] > kept[1] ? next : kept)
  )[0];
}

/**
 * Follows a groove across `stations` (angles round the heart, or distances
 * along it): at the first, the best of the whole `range`; at each next, the
 * best within `reach` of the last, so the course never jumps to another
 * crease. `score` rates a candidate at a station.
 */
function follow(
  stations: readonly number[],
  range: readonly [number, number],
  reach: number,
  score: (station: number, candidate: number) => number
) {
  const first = best(range[0], range[1], 41, (candidate) =>
    score(Arr.getUnsafe(stations, 0), candidate)
  );
  return Arr.scan(Arr.drop(stations, 1), first, (last, station) =>
    best(
      Math.max(range[0], last - reach),
      Math.min(range[1], last + reach),
      15,
      (candidate) => score(station, candidate)
    )
  );
}

/**
 * The atrioventricular groove, where the atria meet the ventricles, at each
 * of `angles` round the heart, turned `aside` from its deepest line.
 */
function atrioventricular(angles: readonly number[], aside: number) {
  const alongs = follow(angles, [-1.8, 1.4], 0.35, (angle, along) =>
    groove(surfaceAt(along, angle))
  );
  return Arr.map(Arr.zip(angles, alongs), ([angle, along]) =>
    surfaceAt(along, angle + aside)
  );
}

/**
 * The posterior interventricular groove, where the two ventricles meet on
 * the back, at each of `alongs`, turned `aside` from its deepest line.
 */
function interventricular(alongs: readonly number[], aside: number) {
  const angles = follow(
    alongs,
    [degrees(-160), degrees(-60)],
    degrees(12),
    (along, angle) => groove(surfaceAt(along, angle))
  );
  return Arr.map(Arr.zip(alongs, angles), ([along, angle]) =>
    surfaceAt(along, angle + aside)
  );
}

/** The outward normal of the outer skin at a point, from the field's slope. */
function normalAt([x, y, z]: Point): Point {
  const step = 0.02;
  const dx = outerField(x + step, y, z) - outerField(x - step, y, z);
  const dy = outerField(x, y + step, z) - outerField(x, y - step, z);
  const dz = outerField(x, y, z + step) - outerField(x, y, z - step);
  const length = Math.hypot(dx, dy, dz);
  return [dx / length, dy / length, dz / length];
}

/** Smooths a course over each point and its two neighbours, as a vessel bends gently. */
function smoothed(points: readonly Point[]) {
  return Arr.map(points, (point, index): Point => {
    const before = Arr.getUnsafe(points, Math.max(0, index - 1));
    const after = Arr.getUnsafe(points, Math.min(points.length - 1, index + 1));
    return [
      (before[0] + 2 * point[0] + after[0]) / 4,
      (before[1] + 2 * point[1] + after[1]) / 4,
      (before[2] + 2 * point[2] + after[2]) / 4,
    ];
  });
}

/**
 * Sets points `lift` outside the outer skin along its normal, wherever they
 * lay near it, so a vessel lies in its groove about half buried in the fat.
 */
function lifted(points: readonly Point[], lift: number) {
  return Arr.map(points, (point): Point => {
    const normal = normalAt(point);
    const move = lift - outerField(point[0], point[1], point[2]);
    return [
      point[0] + normal[0] * move,
      point[1] + normal[1] * move,
      point[2] + normal[2] * move,
    ];
  });
}

/**
 * The coronary vessels behind the cut: each an artery or a vein, its radius
 * in centimetres and the points along its middle, laid in its groove and
 * kept behind the cut.
 */
export function coronaryVessels() {
  const vessel = (
    kind: "artery" | "vein",
    radius: number,
    points: readonly Point[]
  ) => ({
    kind,
    points: Arr.filter(
      lifted(smoothed(points), radius * 0.1),
      ([x, y, z]) => z < cutDepth(x, y) - radius
    ),
    radius,
  });
  // The great cardiac vein turns into the coronary sinus at the back.
  const vein = atrioventricular(
    steps(degrees(15), degrees(-108), 14),
    degrees(-5)
  );
  return [
    vessel(
      "artery",
      0.18,
      atrioventricular(steps(degrees(168), degrees(250), 9), 0)
    ),
    vessel("artery", 0.1, interventricular(steps(1.6, 6.6, 9), degrees(-4))),
    vessel("vein", 0.13, interventricular(steps(1.6, 6.4, 9), degrees(4))),
    vessel(
      "artery",
      0.15,
      atrioventricular(steps(degrees(12), degrees(-55), 8), 0)
    ),
    vessel("vein", 0.22, Arr.take(vein, 7)),
    vessel("vein", 0.42, Arr.drop(vein, 6)),
  ];
}
