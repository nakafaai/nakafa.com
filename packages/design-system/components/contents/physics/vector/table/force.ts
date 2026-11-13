import { Array as Arr, Schema } from "effect";

/**
 * A force table: strings tied to one ring run over pulleys on the rim and
 * hold hanging masses, so each string pulls the ring with the weight of its
 * masses, in the direction the pulley stands. The pulls add as vectors; the
 * ring rests on the middle only when they cancel.
 */

/** Gravity at the bench, in m/s². */
const GRAVITY = 9.8;

/** One string: the hanging mass in grams and the pulley's angle on the rim, in degrees counterclockwise from zero. */
const PullSchema = Schema.Struct({
  angle: Schema.Finite,
  mass: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Pull = typeof PullSchema.Type;

/** A string with its place in the setup, which keys it on the table while its pulley turns. */
const PlacedPullSchema = Schema.Struct({
  ...PullSchema.fields,
  slot: Schema.Int,
});
export type PlacedPull = typeof PlacedPullSchema.Type;

/** The strings of one setup, two or more. */
export const PullsSchema = Schema.Array(PullSchema).pipe(
  Schema.check(Schema.isMinLength(2))
);

/** The pull of one string as a vector in newtons. */
export function pullForce(pull: Pull) {
  const size = (pull.mass / 1000) * GRAVITY;
  const turn = (pull.angle * Math.PI) / 180;
  return { size, x: size * Math.cos(turn), y: size * Math.sin(turn) };
}

/** An angle in degrees brought into [0, 360). */
export function wrapAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

/**
 * The resultant of every string added by components: its parts along zero
 * and ninety degrees, its size and its angle on the rim, in newtons and
 * degrees.
 */
export function tableResultant(pulls: readonly Pull[]) {
  const forces = Arr.map(pulls, pullForce);
  const x = Arr.reduce(forces, 0, (sum, force) => sum + force.x);
  const y = Arr.reduce(forces, 0, (sum, force) => sum + force.y);
  const size = Math.hypot(x, y);
  return {
    angle: size < 1e-9 ? 0 : wrapAngle((Math.atan2(y, x) * 180) / Math.PI),
    size,
    x,
    y,
  };
}

/**
 * The same resultant of two pulls by the cosine rule, from their sizes and
 * the angle between them, and the angle it makes with the first pull by the
 * sine rule.
 */
export function twoPullResultant(first: Pull, second: Pull) {
  const a = pullForce(first).size;
  const b = pullForce(second).size;
  const between = Math.abs(wrapAngle(second.angle - first.angle + 180) - 180);
  const turn = (between * Math.PI) / 180;
  const size = Math.sqrt(
    Math.max(0, a * a + b * b + 2 * a * b * Math.cos(turn))
  );
  const fromFirst =
    size < 1e-9
      ? 0
      : (Math.asin(Math.min(1, (b * Math.sin(turn)) / size)) * 180) / Math.PI;
  return {
    between,
    fromFirst: a * a + size * size < b * b ? 180 - fromFirst : fromFirst,
    size,
  };
}
