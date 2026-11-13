import { Array as Arr, Schema } from "effect";
import {
  type Face,
  normalOf,
  type Rgb,
  type Vec,
} from "@/lib/island/models/parts";
import { colorOf, type Ramp, type Tone } from "@/lib/island/palette";

/**
 * One ring of a tube (ADR 0047, D21): its middle, and its half width and half
 * height across the tube's path. A ring with no width and no height is a tip.
 */
const Ring = Schema.Struct({
  at: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  high: Schema.Finite,
  wide: Schema.Finite,
});
export type Ring = typeof Ring.Type;

/**
 * Where a face of a tube sits, for its paint: its ring and side, how far along
 * the tube it lies (0 at the first ring, 1 at the last), and which way it
 * faces across the tube (`up` 1 on top and -1 underneath, `across` 1 on the
 * right and -1 on the left).
 */
const Spot = Schema.Struct({
  across: Schema.Finite,
  along: Schema.Finite,
  segment: Schema.Int,
  side: Schema.Int,
  up: Schema.Finite,
});
export type Spot = typeof Spot.Type;

/** A color for every face, or one color by where the face sits. */
export type Paint = Rgb | ((spot: Spot) => Rgb);

/** One tone of one ramp of the island's palette, as red, green and blue from 0 to 1. */
export function tint(ramp: Ramp, tone: Tone = 1): Rgb {
  const [red, green, blue] = colorOf(ramp, tone);
  return [red / 255, green / 255, blue / 255];
}

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const times = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec): Vec => times(a, 1 / Math.hypot(a[0], a[1], a[2]));

/** The way a tube runs at one ring: toward the next ring, from the one before. */
function headingAt(rings: readonly Ring[], index: number) {
  const before = rings[Math.max(0, index - 1)].at;
  const after = rings[Math.min(rings.length - 1, index + 1)].at;
  return unit(sub(after, before));
}

/**
 * The corners of one ring around its heading: the first edge lies flat on top,
 * so a tube's back catches the sun as one crisp face, and the corners run
 * counter-clockwise seen down the heading.
 */
function cornersOf(ring: Ring, heading: Vec, sides: number) {
  const reference: Vec = Math.abs(heading[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0];
  const right = unit(cross(reference, heading));
  const top = cross(heading, right);
  return Arr.makeBy(sides, (index): Vec => {
    const angle = Math.PI / 2 + Math.PI / sides + (2 * Math.PI * index) / sides;
    return add(
      ring.at,
      add(
        times(right, ring.wide * Math.cos(angle)),
        times(top, ring.high * Math.sin(angle))
      )
    );
  });
}

const colorAt = (paint: Paint, spot: Spot) =>
  typeof paint === "function" ? paint(spot) : paint;

const isTip = (ring: Ring) => ring.wide === 0 && ring.high === 0;

/**
 * A tube through rings along a path (ADR 0047, D21): the low-poly hull every
 * body, limb, neck, tail and stem is built from. Each ring is a polygon of
 * `sides` corners square to the path; neighbouring rings are joined by flat
 * faces, a tip ring closes its end to a point, and any other end is capped,
 * so every tube is closed and every face points out.
 */
export function tube(
  rings: Arr.NonEmptyReadonlyArray<Ring>,
  paint: Paint,
  sides = 6
): readonly Face[] {
  const corners = Arr.map(rings, (ring, index) =>
    cornersOf(ring, headingAt(rings, index), sides)
  );
  const last = rings.length - 1;
  const spotOf = (segment: number, side: number): Spot => {
    const middle = Math.PI / 2 + (2 * Math.PI * (side + 1)) / sides;
    return {
      across: Math.cos(middle),
      along: (segment + 0.5) / last,
      segment,
      side,
      up: Math.sin(middle),
    };
  };
  const walls = Arr.flatMap(
    Arr.makeBy(last, (segment) => segment),
    (segment) =>
      Arr.makeBy(sides, (side): Face => {
        const next = (side + 1) % sides;
        const [a, b] = [corners[segment], corners[segment + 1]];
        const color = colorAt(paint, spotOf(segment, side));
        if (isTip(rings[segment])) {
          return { color, corners: [a[side], b[next], b[side]] };
        }
        if (isTip(rings[segment + 1])) {
          return { color, corners: [a[side], a[next], b[side]] };
        }
        return { color, corners: [a[side], a[next], b[next], b[side]] };
      })
  );
  const cap = (along: number): Spot => ({
    across: 0,
    along,
    segment: along === 0 ? 0 : last,
    side: -1,
    up: 0,
  });
  const ends = [
    ...(isTip(rings[0])
      ? []
      : [
          {
            color: colorAt(paint, cap(0)),
            corners: Arr.reverse(corners[0]),
          },
        ]),
    ...(isTip(rings[last])
      ? []
      : [{ color: colorAt(paint, cap(1)), corners: corners[last] }]),
  ];
  return [...walls, ...ends];
}

/**
 * A low-poly ball (ADR 0047, D21): a tube along `axis` (z unless given) from
 * tip to tip through `bands` rings, its radii along that axis and across it.
 */
export function ball(
  center: Vec,
  [wide, high, deep]: Vec,
  paint: Paint,
  bands = 3,
  sides = 6
): readonly Face[] {
  const ring = (index: number): Ring => {
    const angle = (Math.PI * index) / (bands + 1);
    const across = index === 0 || index === bands + 1 ? 0 : Math.sin(angle);
    return {
      at: [center[0], center[1], center[2] - deep * Math.cos(angle)],
      high: high * across,
      wide: wide * across,
    };
  };
  const [first, ...rest] = Arr.makeBy(bands + 2, ring);
  return tube([first, ...rest], paint, sides);
}

/**
 * A rod from one point to another (ADR 0047, D21), its half thickness at the
 * start and at the end, and a tip at the end when `end` is 0: a leg, an arm,
 * a horn, a stem.
 */
export function rod(
  from: Vec,
  to: Vec,
  [start, end]: readonly [number, number],
  paint: Paint,
  sides = 4
): readonly Face[] {
  return tube(
    [
      { at: from, high: start, wide: start },
      { at: to, high: end, wide: end },
    ],
    paint,
    sides
  );
}

/**
 * A thin flat slab through three or more corners of one plane, `thickness`
 * through: a wing, a fin, an ear, a leaf, a petal. It is closed like every
 * other solid, so it reads from both sides and never flickers against itself.
 */
export function slab(
  corners: Arr.NonEmptyReadonlyArray<Vec>,
  thickness: number,
  color: Rgb
): readonly Face[] {
  const normal = normalOf(corners);
  const front = Arr.map(corners, (corner) =>
    add(corner, times(normal, thickness / 2))
  );
  const back = Arr.map(corners, (corner) =>
    add(corner, times(normal, -thickness / 2))
  );
  const count = corners.length;
  const rims = Arr.makeBy(count, (index): Face => {
    const next = (index + 1) % count;
    return {
      color,
      corners: [back[index], back[next], front[next], front[index]],
    };
  });
  return [
    { color, corners: front },
    { color, corners: Arr.reverse(back) },
    ...rims,
  ];
}

/** Faces grown by `factor` from the origin. */
export function scaled(faces: readonly Face[], factor: number) {
  return Arr.map(faces, (face) => ({
    color: face.color,
    corners: Arr.map(face.corners, (corner) => times(corner, factor)),
  }));
}

/** Faces moved by `offset`. */
export function moved(faces: readonly Face[], offset: Vec) {
  return Arr.map(faces, (face) => ({
    color: face.color,
    corners: Arr.map(face.corners, (corner) => add(corner, offset)),
  }));
}
