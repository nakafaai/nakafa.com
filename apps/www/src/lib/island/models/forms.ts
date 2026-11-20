import { Array as Arr } from "effect";
import type { Face, Rgb, Vec } from "@/lib/island/models/parts";
import { box } from "@/lib/island/models/parts";
import type { Paint, Ring } from "@/lib/island/models/solids";
import { slab, tube } from "@/lib/island/models/solids";

/**
 * A color a shade lighter (`by` over 1) or darker (under 1): neighbouring
 * planks, stones and leaves step in tone, so the edge pass rules a line
 * between them (ADR 0047, D44).
 */
export function toned(color: Rgb, by: number): Rgb {
  return [
    Math.min(1, color[0] * by),
    Math.min(1, color[1] * by),
    Math.min(1, color[2] * by),
  ];
}

/** A leaf from `from` out toward `to`, `wide` across at its middle. */
export function leaf(from: Vec, to: Vec, wide: number, color: Rgb) {
  const middle: Vec = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2 + wide * 0.3,
    (from[2] + to[2]) / 2,
  ];
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const across = Math.hypot(dx, dz);
  const side: Vec = [(-dz / across) * wide, 0, (dx / across) * wide];
  return slab(
    [
      from,
      [middle[0] + side[0], middle[1], middle[2] + side[2]],
      to,
      [middle[0] - side[0], middle[1], middle[2] - side[2]],
    ],
    0.012,
    color
  );
}

/** The faces of `count` parts in a row, each made from its index. */
export function row(
  count: number,
  make: (index: number) => readonly Face[]
): readonly Face[] {
  return Arr.flatMap(
    Arr.makeBy(count, (index) => index),
    make
  );
}

/** The faces of `count` parts spaced evenly round the upright axis from the angle `turn`, each made from its angle and its index. */
export function around(
  count: number,
  turn: number,
  make: (angle: number, index: number) => readonly Face[]
): readonly Face[] {
  return row(count, (index) =>
    make(turn + (index / count) * Math.PI * 2, index)
  );
}

/** A box standing on `foot`, the middle of its base: `size` across, up and deep, its top drawn in by `taper` as `box` draws it. */
export function block(foot: Vec, size: Vec, color: Rgb, taper = 0) {
  const [x, y, z] = foot;
  const [wide, high, deep] = size;
  return box(
    [x - wide / 2, y, z - deep / 2],
    [x + wide / 2, y + high, z + deep / 2],
    color,
    taper
  );
}

/**
 * A roof over a base standing on `foot`, `size` across and deep, rising to a
 * ridge `ridge` long that runs across: a hip roof while the ridge is shorter
 * than the base, a gable when it is as long, a pyramid when it has no length.
 * `colors` are its slopes to the front and the back, its ends, and the soffit
 * underneath.
 */
export function roof(
  foot: Vec,
  size: Vec,
  ridge: number,
  colors: readonly [Rgb, Rgb, Rgb]
): readonly Face[] {
  const [x, y, z] = foot;
  const [wide, high, deep] = size;
  const [slope, end, soffit] = colors;
  const base: readonly Vec[] = [
    [x - wide / 2, y, z + deep / 2],
    [x + wide / 2, y, z + deep / 2],
    [x + wide / 2, y, z - deep / 2],
    [x - wide / 2, y, z - deep / 2],
  ];
  const top: readonly Vec[] = [
    [x - ridge / 2, y + high, z],
    [x + ridge / 2, y + high, z],
  ];
  return [
    { color: slope, corners: [base[0], base[1], top[1], top[0]] },
    { color: end, corners: [base[1], base[2], top[1]] },
    { color: slope, corners: [base[2], base[3], top[0], top[1]] },
    { color: end, corners: [base[3], base[0], top[0]] },
    { color: soffit, corners: [base[3], base[2], base[1], base[0]] },
  ];
}

/**
 * A low-poly ball whose poles stand upright: a tube from its lowest point to
 * its highest through `bands` rings of `sides` corners, so a crown, a boulder
 * or a balloon is painted in bands from its underside (`along` 0) to its top.
 */
export function lobe(
  center: Vec,
  radii: Vec,
  paint: Paint,
  bands: number,
  sides: number
): readonly Face[] {
  const ring = (index: number): Ring => {
    const angle = (Math.PI * index) / (bands + 1);
    const across = index === 0 || index === bands + 1 ? 0 : Math.sin(angle);
    return {
      at: [center[0], center[1] - radii[1] * Math.cos(angle), center[2]],
      high: radii[2] * across,
      wide: radii[0] * across,
    };
  };
  const [first, ...rest] = Arr.makeBy(bands + 2, ring);
  return tube([first, ...rest], paint, sides);
}

/**
 * A clump of leaves round `center` (ADR 0047, D21): a shallow point hanging
 * under a wide hem, a belt that draws in above it, and a low cone on top, so
 * a crown's lobe shows a shaded underside, a body and a sunlit top from any
 * side. It reaches `radii` across and deep, and as far up from its center.
 */
export function dome(
  center: Vec,
  radii: Vec,
  paint: Paint,
  sides: number
): readonly Face[] {
  const [x, y, z] = center;
  const [wide, high, deep] = radii;
  return tube(
    [
      { at: [x, y - high * 0.45, z], high: 0, wide: 0 },
      { at: [x, y - high * 0.05, z], high: deep, wide },
      { at: [x, y + high * 0.6, z], high: deep * 0.7, wide: wide * 0.7 },
      { at: [x, y + high, z], high: 0, wide: 0 },
    ],
    paint,
    sides
  );
}

/**
 * An upright ring wall standing on `foot`, open through its middle: `sides`
 * flat sides round, `half` from its middle to its outer sides across and
 * deep, `thick` through and `high` tall, so four sides make a planter or a
 * basket and ten a well's stones. Its sides step in tone from one to the
 * next, its inside is in shade, and its rim takes its own color.
 */
export function hoop(
  foot: Vec,
  half: readonly [number, number],
  thick: number,
  high: number,
  colors: readonly [Rgb, Rgb],
  sides: number
): readonly Face[] {
  const [wall, rim] = colors;
  const stretch = 1 / Math.cos(Math.PI / sides);
  const corner = (index: number, inset: number, up: number): Vec => {
    const angle = Math.PI / sides + (index / sides) * Math.PI * 2;
    return [
      foot[0] + (half[0] - inset) * stretch * Math.cos(angle),
      foot[1] + up,
      foot[2] + (half[1] - inset) * stretch * Math.sin(angle),
    ];
  };
  return row(sides, (index) => {
    const next = (index + 1) % sides;
    return [
      {
        color: index % 2 === 0 ? wall : toned(wall, 0.9),
        corners: [
          corner(next, 0, 0),
          corner(index, 0, 0),
          corner(index, 0, high),
          corner(next, 0, high),
        ],
      },
      {
        color: toned(wall, 0.7),
        corners: [
          corner(index, thick, 0),
          corner(next, thick, 0),
          corner(next, thick, high),
          corner(index, thick, high),
        ],
      },
      {
        color: rim,
        corners: [
          corner(index, 0, high),
          corner(index, thick, high),
          corner(next, thick, high),
          corner(next, 0, high),
        ],
      },
      {
        color: rim,
        corners: [
          corner(next, 0, 0),
          corner(next, thick, 0),
          corner(index, thick, 0),
          corner(index, 0, 0),
        ],
      },
    ];
  });
}

/** Faces turned about the upright axis by `angle`, their front (+z) toward the right (+x). */
export function turned(faces: readonly Face[], angle: number): readonly Face[] {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return Arr.map(faces, (face) => ({
    ...face,
    corners: Arr.map(
      face.corners,
      ([x, y, z]): Vec => [x * cos + z * sin, y, z * cos - x * sin]
    ),
  }));
}

/** Faces rolled about the front-to-back axis through `pivot` by `angle`, counter-clockwise seen from the front, as a spinning part turns. */
export function rolled(
  faces: readonly Face[],
  angle: number,
  pivot: Vec
): readonly Face[] {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return Arr.map(faces, (face) => ({
    ...face,
    corners: Arr.map(face.corners, ([x, y, z]): Vec => {
      const [dx, dy] = [x - pivot[0], y - pivot[1]];
      return [
        pivot[0] + dx * cos - dy * sin,
        pivot[1] + dx * sin + dy * cos,
        z,
      ];
    }),
  }));
}
