import { Schema } from "effect";

/** A place or a direction in space: x, y and z. Atoms are placed in angstrom. */
export const PointSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Point = typeof PointSchema.Type;

/** The origin, and the vector of no length. */
export const ORIGIN: Point = [0, 0, 0];

/** The sum of two vectors. */
export function add(a: Point, b: Point): Point {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** The vector from `b` to `a`. */
export function sub(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** A vector stretched by `factor`. */
export function scale(a: Point, factor: number): Point {
  return [a[0] * factor, a[1] * factor, a[2] * factor];
}

/** The dot product of two vectors. */
export function dot(a: Point, b: Point) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** The cross product of two vectors, at right angles to both. */
export function cross(a: Point, b: Point): Point {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** How long a vector is. */
export function length(a: Point) {
  return Math.sqrt(dot(a, a));
}

/** The vector of length one along `a`; a vector of no length stays as it is. */
export function unit(a: Point): Point {
  const size = length(a);
  return size === 0 ? a : scale(a, 1 / size);
}

/**
 * A unit vector at right angles to `axis`, leaning toward `toward` when that
 * gives a direction, and any steady perpendicular when it does not: the side
 * a double bond's second rod or a lone atom's first hydrogen goes to.
 */
export function aside(axis: Point, toward: Point): Point {
  const along = unit(axis);
  const lean = sub(toward, scale(along, dot(toward, along)));
  if (length(lean) > 1e-6) {
    return unit(lean);
  }
  const spare: Point = Math.abs(along[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return unit(cross(along, spare));
}

/** A point turned about the z axis by `angle` radians and lifted by `rise`. */
export function screw(point: Point, angle: number, rise: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    point[0] * cos - point[1] * sin,
    point[0] * sin + point[1] * cos,
    point[2] + rise,
  ];
}
