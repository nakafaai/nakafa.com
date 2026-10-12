import { SHOULDER } from "@repo/mascot/nina/body";
import { LookSchema, MoodSchema } from "@repo/mascot/nina/face";
import { type Curve, CurveSchema, flip } from "@repo/mascot/nina/limb";
import type { Mark } from "@repo/mascot/nina/mark";
import type { Shape } from "@repo/mascot/shape";
import { Array as Arr, Predicate, Schema } from "effect";

/**
 * Where an arm is drawn: "back" behind her body, or "front" over her body and
 * over what she holds. An arm always starts behind her body; only the part
 * that has left her body is drawn on top.
 */
const LayerSchema = Schema.Literals(["back", "front"]);

/**
 * One shape of her picture. The kernel types a shape by its mark and no Schema
 * describes it, so this checks only that it names what it draws.
 */
const ShapeSchema = Schema.declare((input: unknown): input is Shape<Mark> =>
  Predicate.hasProperty(input, "_tag")
);

/**
 * The numbers that describe her: how her body sits, where every arm and leg
 * bends, what her face does and what she holds. An act answers them for every
 * moment.
 */
export const PoseSchema = Schema.Struct({
  above: Schema.Array(ShapeSchema),
  armL: CurveSchema,
  armR: CurveSchema,
  held: Schema.Array(ShapeSchema),
  layer: Schema.Tuple([LayerSchema, LayerSchema]),
  legs: Schema.Array(CurveSchema),
  lift: Schema.Finite,
  look: Schema.optionalKey(LookSchema),
  mood: Schema.optionalKey(MoodSchema),
  shift: Schema.Finite,
  tilt: Schema.Finite,
});

export type Pose = typeof PoseSchema.Type;

/**
 * Her limbs at rest. An arm hangs at her side with its tip curled out; a leg
 * lies on the floor with its tip curled up. Arms are written for her left side
 * and mirrored for her right.
 */
const REST_ARM: Curve = [80, 146, 38, 166, 36, 204, 12, 200];
const REST_LEGS: readonly [Curve, Curve] = [
  [74, 186, 46, 228, 22, 264, 0, 238],
  [92, 192, 86, 240, 64, 276, 40, 252],
];

export const REST: Pose = {
  above: [],
  armL: REST_ARM,
  armR: flip(REST_ARM),
  held: [],
  layer: ["back", "back"],
  legs: [REST_LEGS[0], REST_LEGS[1], flip(REST_LEGS[1]), flip(REST_LEGS[0])],
  lift: 0,
  shift: 0,
  tilt: 0,
};

/** An arm from her left shoulder through two bends to its tip. */
export function armLeft(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
): Curve {
  return [SHOULDER[0], SHOULDER[1], a, b, c, d, e, f];
}

/** The same arm on her right side. */
export function armRight(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
): Curve {
  return flip(armLeft(a, b, c, d, e, f));
}

/** A little life for a limb at rest: its bend and its tip drift. */
export function sway(c: Curve, t: number, phase: number, much: number): Curve {
  return [
    c[0],
    c[1],
    c[2],
    c[3],
    c[4] + Math.sin(t * 1.1 + phase) * 3 * much,
    c[5],
    c[6] + Math.sin(t * 1.1 + phase + 0.9) * 5 * much,
    c[7] + Math.cos(t * 1.3 + phase) * 2.5 * much,
  ];
}

/** Every leg drifts, each out of step with the one before. */
export function swayLegs(
  legs: readonly Curve[],
  t: number,
  much: number
): readonly Curve[] {
  return Arr.map(legs, (leg, i) => sway(leg, t, i * 1.7, much));
}

/** She breathes: her body rises and tilts a little, and her legs drift. */
export function breathe(pose: Pose, t: number): Pose {
  return {
    ...pose,
    legs: swayLegs(pose.legs, t, 0.8),
    lift: pose.lift + Math.sin(t * 1.7) * 1.6,
    tilt: pose.tilt + Math.sin(t * 0.6) * 1.1,
  };
}
