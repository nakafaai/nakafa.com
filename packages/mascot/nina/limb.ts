import { type ARM, TORSO_CURVES, TORSO_START } from "@repo/mascot/nina/body";
import { at, type Place } from "@repo/mascot/nina/point";
import { Array as Arr, Schema } from "effect";

/** How thick a limb is at its root and at its tip. */
type Girth = typeof ARM;

const STEPS = 16;

/** One middle line of a limb as a cubic curve: the root, two bends and the tip. */
export const CurveSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);

export type Curve = typeof CurveSchema.Type;

/** The same curve on her other side. Her middle is at x = 102. */
export function flip([a, b, c, d, e, f, g, h]: Curve): Curve {
  return [204 - a, b, 204 - c, d, 204 - e, f, 204 - g, h];
}

/** One coordinate of a cubic curve with these four control values, at `t`. */
export function cubic(a: number, b: number, c: number, d: number, t: number) {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
}

/** How fast that coordinate changes at `t`. */
export function slope(a: number, b: number, c: number, d: number, t: number) {
  const m = 1 - t;
  return 3 * m * m * (b - a) + 6 * m * t * (c - b) + 3 * t * t * (d - c);
}

/** How fast that rate of change itself changes at `t`. */
export function bend(a: number, b: number, c: number, d: number, t: number) {
  const m = 1 - t;
  return 6 * m * (c - 2 * b + a) + 6 * t * (d - 2 * c + b);
}

/**
 * Half the width of a limb at `t` along its middle line: `thick` at the root,
 * `thin` at the tip, and wider still over the first half, where it joins her
 * body.
 */
export function wide(t: number, { thick, thin }: Girth) {
  const join = Math.max(0, 1 - t / 0.5);
  return (thick + (thin - thick) * t ** 0.85) / 2 + thick * 0.45 * join * join;
}

/**
 * The outline of her body as points, for asking whether a place is on it:
 * twelve along each of its four curves, each of which starts where the one
 * before it ended.
 */
const TORSO_POINTS = Arr.flatMap(
  TORSO_CURVES,
  ([first, second, end], index) => {
    const from = index === 0 ? TORSO_START : TORSO_CURVES[index - 1][2];
    return Arr.makeBy(12, (i): Place => {
      const t = i / 12;
      return [
        cubic(from[0], first[0], second[0], end[0], t),
        cubic(from[1], first[1], second[1], end[1], t),
      ];
    });
  }
);

/** Each point of the outline with the one before it, the first with the last. */
const TORSO_EDGES = Arr.zip(TORSO_POINTS, Arr.rotate(TORSO_POINTS, 1));

/** Whether a place is on her body. */
export function onBody(x: number, y: number) {
  return Arr.reduce(TORSO_EDGES, false, (inside, [current, previous]) => {
    const crosses =
      current[1] > y !== previous[1] > y &&
      x <
        ((previous[0] - current[0]) * (y - current[1])) /
          (previous[1] - current[1]) +
          current[0];
    return crosses ? !inside : inside;
  });
}

/** Where on the middle line of a limb, and which way it runs there. */
function frame(c: Curve, t: number) {
  const dx = slope(c[0], c[2], c[4], c[6], t);
  const dy = slope(c[1], c[3], c[5], c[7], t);
  return {
    dx,
    dy,
    len: Math.sqrt(dx * dx + dy * dy) || 1,
    x: cubic(c[0], c[2], c[4], c[6], t),
    y: cubic(c[1], c[3], c[5], c[7], t),
  };
}

/**
 * Where along its middle line an arm has left her body with its whole width.
 * The part of an arm that is drawn on top starts there, in the open, where it
 * lies exactly on the arm drawn behind her, so the start cannot be seen.
 */
export function exit(c: Curve, girth: Girth): number {
  const search = (t: number): number => {
    if (t >= 0.8) {
      return 0.8;
    }
    const { dx, dy, len, x, y } = frame(c, t);
    const half = wide(t, girth) + 2;
    const open = !(
      onBody(x, y) ||
      onBody(x - (dy / len) * half, y + (dx / len) * half) ||
      onBody(x + (dy / len) * half, y - (dx / len) * half)
    );
    return open ? t : search(t + 0.03);
  };
  return search(0.12);
}

/** The middle of two places, written the way the outline is. */
function middle(a: Place, b: Place) {
  return at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}

/** Both edges of a limb and the places that round its two ends. */
function edges(c: Curve, girth: Girth, start: number) {
  const sides = Arr.makeBy(STEPS + 1, (i) => {
    const t = start + ((1 - start) * i) / STEPS;
    const { dx, dy, len, x, y } = frame(c, t);
    const ddx = bend(c[0], c[2], c[4], c[6], t);
    const ddy = bend(c[1], c[3], c[5], c[7], t);
    const turn = Math.abs(dx * ddy - dy * ddx);
    const width = wide(t, girth);
    const half =
      turn > 0.000_001
        ? Math.min(width, (0.9 * len * len * len) / turn)
        : width;
    return {
      left: [x - (dy / len) * half, y + (dx / len) * half] as const,
      right: [x + (dy / len) * half, y - (dx / len) * half] as const,
      ux: dx / len,
      uy: dy / len,
      x,
      y,
    };
  });
  const first = sides[0];
  const last = sides[STEPS];
  return {
    left: Arr.map(sides, ({ left }) => left),
    right: Arr.map(sides, ({ right }) => right),
    root: [
      first.x - first.ux * girth.thick * 0.5,
      first.y - first.uy * girth.thick * 0.5,
    ] as const,
    tip: [
      last.x + last.ux * girth.thin * 1.1,
      last.y + last.uy * girth.thin * 1.1,
    ] as const,
  };
}

/**
 * The outline of one tentacle. `c` is its middle line as a cubic curve (root,
 * two bends, tip). The limb is `thick` at the root and `thin` at the tip, and
 * round at both ends. In a bend it is never wider than the bend allows, so its
 * outline cannot fold over itself. `from` (0 to 1) draws only the part from
 * that point of the middle line to the tip, cut straight where it starts: the
 * part of an arm that lies over what she holds.
 */
export function limb(c: Curve, girth: Girth, from = 0) {
  const { left, right, root, tip } = edges(c, girth, from);
  const inner = Arr.range(1, STEPS - 1);
  const leftSide = Arr.join(
    Arr.map(
      inner,
      (a) => ` Q${at(...left[a])} ${middle(left[a], left[a + 1])}`
    ),
    ""
  );
  const rightSide = Arr.join(
    Arr.map(
      Arr.reverse(inner),
      (b) => ` Q${at(...right[b])} ${middle(right[b], right[b - 1])}`
    ),
    ""
  );
  // A whole limb is round at its root too. A part of one is cut straight.
  const rounded = from === 0 ? ` Q${at(...root)} ${at(...left[0])}` : "";
  return `M${at(...left[0])} L${middle(left[0], left[1])}${leftSide} L${at(...left[STEPS])} Q${at(...tip)} ${at(...right[STEPS])} L${middle(right[STEPS], right[STEPS - 1])}${rightSide} L${at(...right[0])}${rounded} Z`;
}
