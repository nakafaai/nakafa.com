import { Schema } from "effect";

/**
 * Turns in three dimensions as unit quaternions, written x, y, z, w, so a
 * die's orientation can be computed, tested and blended without the scene.
 * A turn of `angle` radians about a unit `axis` follows the right-hand rule,
 * and `multiply(a, b)` turns by `b` first, then by `a`, as three.js does.
 */

/** Three coordinates: a position, a direction or an axis. */
export const TripleSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Triple = typeof TripleSchema.Type;

/** A unit quaternion: the vector part x, y, z, then the scalar w. */
export const QuaternionSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type Quaternion = typeof QuaternionSchema.Type;

/** No turn at all. */
export const IDENTITY: Quaternion = [0, 0, 0, 1];

/** A turn of `angle` radians about the unit `axis`. */
export function axisAngle(axis: Triple, angle: number): Quaternion {
  const half = angle / 2;
  const sine = Math.sin(half);
  return [axis[0] * sine, axis[1] * sine, axis[2] * sine, Math.cos(half)];
}

/** The turn `b`, then the turn `a`. */
export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** The opposite turn of a unit quaternion. */
export function inverse(q: Quaternion): Quaternion {
  return [-q[0], -q[1], -q[2], q[3]];
}

/** Where the turn `q` takes the vector `v`. */
export function rotate(q: Quaternion, v: Triple): Triple {
  const turned = multiply(multiply(q, [v[0], v[1], v[2], 0]), inverse(q));
  return [turned[0], turned[1], turned[2]];
}

/**
 * The turn a fraction `w` of the way from `a` to `b` along the shorter arc,
 * at a steady angular speed (spherical linear interpolation).
 */
export function slerp(a: Quaternion, b: Quaternion, w: number): Quaternion {
  const raw = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const sign = raw < 0 ? -1 : 1;
  const cosine = Math.min(1, raw * sign);
  const angle = Math.acos(cosine);
  if (angle < 1e-6) {
    return b;
  }
  const from = Math.sin((1 - w) * angle) / Math.sin(angle);
  const to = (sign * Math.sin(w * angle)) / Math.sin(angle);
  return [
    a[0] * from + b[0] * to,
    a[1] * from + b[1] * to,
    a[2] * from + b[2] * to,
    a[3] * from + b[3] * to,
  ];
}
