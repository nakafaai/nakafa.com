import type { MathVisual } from "@nakafa/aksara-contracts/math/visual";

/**
 * The coefficients of the quadratic x squared minus four x plus three. This is a
 * copy of the scene that Aksara does not publish: the linked lesson draws x squared
 * minus two x minus three, with its vertex at (1,-4), so the two curves differ.
 */
const CURVE = { a: 1, b: -4, c: 3 };

/** The height of the curve at `x`. */
export function quadratic(x: number) {
  return CURVE.a * x * x + CURVE.b * x + CURVE.c;
}

/** The line through the vertex, halfway between the two roots: minus b over 2a. */
const AXIS = -CURVE.b / (2 * CURVE.a);

/** How far each root lies from the axis: the square root of the discriminant over 2a. */
const HALF_SPAN =
  Math.sqrt(CURVE.b * CURVE.b - 4 * CURVE.a * CURVE.c) / (2 * CURVE.a);

/** The two roots and the vertex of the curve, each with its height from the formula. */
export const QUADRATIC_POINTS = {
  left: { x: AXIS - HALF_SPAN, y: quadratic(AXIS - HALF_SPAN) },
  right: { x: AXIS + HALF_SPAN, y: quadratic(AXIS + HALF_SPAN) },
  vertex: { x: AXIS, y: quadratic(AXIS) },
};

/** The plane of the lesson: the curve across its two roots, with the three points on it. */
export const QUADRATIC_SCENE = {
  space: "plane",
  frame: {
    kind: "cartesian",
    x: { min: -0.5, max: 4.5 },
    y: { min: -2, max: 6 },
  },
  view: { kind: "fit", padding: 0.1 },
  objects: [
    {
      id: "curve",
      kind: "quadratic",
      inputAxis: "x",
      coefficients: CURVE,
      domain: { min: -0.5, max: 4.5 },
      appearance: "primary",
    },
    {
      id: "left",
      kind: "point",
      at: QUADRATIC_POINTS.left,
      appearance: "answer",
    },
    {
      id: "right",
      kind: "point",
      at: QUADRATIC_POINTS.right,
      appearance: "answer",
    },
    {
      id: "vertex",
      kind: "point",
      at: QUADRATIC_POINTS.vertex,
      appearance: "answer",
    },
  ],
  labels: [
    {
      key: "left",
      objectId: "left",
      at: QUADRATIC_POINTS.left,
      placement: "below",
    },
    {
      key: "right",
      objectId: "right",
      at: QUADRATIC_POINTS.right,
      placement: "below",
    },
    {
      key: "vertex",
      objectId: "vertex",
      at: QUADRATIC_POINTS.vertex,
      placement: "below",
    },
  ],
} satisfies MathVisual;
