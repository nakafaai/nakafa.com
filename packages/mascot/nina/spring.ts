import type { Curve } from "@repo/mascot/nina/limb";
import type { Pose } from "@repo/mascot/nina/pose";
import { Array as Arr, Schema } from "effect";

/**
 * Her limbs follow the act through springs, so a change of act never jumps and
 * a tentacle always overshoots a little, like a soft thing. One spring runs
 * after each number of her pose: `x` is where it is and `v` how fast it moves.
 */
export const SpringsSchema = Schema.Struct({
  v: Schema.Array(Schema.Finite),
  x: Schema.Array(Schema.Finite),
});

type Springs = typeof SpringsSchema.Type;

/** How hard a spring pulls toward its number, and how much it holds back. */
const gains = (count: number, stiff: number, damp: number) =>
  Arr.replicate([stiff, damp] as const, count);

/** All of her moves: her body, her two arms and her four legs. */
const WHOLE = [
  ...gains(2, 240, 22),
  ...gains(1, 160, 18),
  ...gains(16, 230, 21),
  ...gains(32, 120, 15),
];

/** Over an edge only her two arms move. */
const PEEK = gains(16, 260, 20);

/** The numbers of her whole pose that the springs follow. */
export function wholeNumbers(pose: Pose) {
  return [
    pose.lift,
    pose.shift,
    pose.tilt,
    ...pose.armL,
    ...pose.armR,
    ...Arr.flatten(pose.legs),
  ];
}

/** The numbers of her two arms over an edge. */
export function peekNumbers(pose: Pose) {
  return [...pose.armL, ...pose.armR];
}

/** A set of springs that rest on their numbers. */
export function settle(numbers: readonly number[]): Springs {
  return { v: Arr.map(numbers, () => 0), x: numbers };
}

/**
 * Moves every spring toward its number for `dt` seconds. A frame that took
 * long is cut into small pieces by the caller, so a slow frame cannot throw a
 * limb.
 */
function follow(
  springs: Springs,
  numbers: readonly number[],
  table: readonly (readonly [number, number])[],
  dt: number
): Springs {
  const next = Arr.map(numbers, (target, i) => {
    const [stiff, damp] = table[i];
    const velocity =
      springs.v[i] +
      (stiff * (target - springs.x[i]) - damp * springs.v[i]) * dt;
    return { v: velocity, x: springs.x[i] + velocity * dt };
  });
  return {
    v: Arr.map(next, ({ v }) => v),
    x: Arr.map(next, ({ x }) => x),
  };
}

/** Moves the springs of her whole pose. */
export function followWhole(springs: Springs, pose: Pose, dt: number): Springs {
  return follow(springs, wholeNumbers(pose), WHOLE, dt);
}

/** Moves the springs of her two arms over an edge. */
export function followPeek(springs: Springs, pose: Pose, dt: number): Springs {
  return follow(springs, peekNumbers(pose), PEEK, dt);
}

/** The curve that eight springs hold from `at`. */
function curveAt(x: readonly number[], at: number): Curve {
  return [
    x[at],
    x[at + 1],
    x[at + 2],
    x[at + 3],
    x[at + 4],
    x[at + 5],
    x[at + 6],
    x[at + 7],
  ];
}

/** Her pose as the springs hold it, with what the springs do not move from `pose`. */
export function wholeSprung(springs: Springs, pose: Pose): Pose {
  const { x } = springs;
  return {
    ...pose,
    armL: curveAt(x, 3),
    armR: curveAt(x, 11),
    legs: Arr.makeBy(4, (i) => curveAt(x, 19 + 8 * i)),
    lift: x[0],
    shift: x[1],
    tilt: x[2],
  };
}

/** Her pose over an edge as the springs hold her arms. */
export function peekSprung(springs: Springs, pose: Pose): Pose {
  return {
    ...pose,
    armL: curveAt(springs.x, 0),
    armR: curveAt(springs.x, 8),
  };
}
