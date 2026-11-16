import { LookSchema, type MoodSchema } from "@repo/mascot/nina/face";
import { type Parts, turned } from "@repo/mascot/nina/goods/part";
import { type Curve, CurveSchema, flip } from "@repo/mascot/nina/limb";
import {
  armLeft,
  breathe,
  type Pose,
  PoseSchema,
  REST,
  sway,
} from "@repo/mascot/nina/pose";
import { Schema } from "effect";

/**
 * How she has the one thing of a deed: in both arms in front of her, held out
 * beside her, raised high, down at the floor, standing on the floor beside
 * her, one half in each arm, up at her eyes, over her head while she
 * shrugs, drawn back at her shoulder, ready to throw, or in one arm in front
 * of her chest.
 */
const HoldSchema = Schema.Literals([
  "front",
  "out",
  "up",
  "low",
  "beside",
  "apart",
  "eyes",
  "over",
  "throw",
  "chest",
]);

type Mood = typeof MoodSchema.Type;

/** What a hold answers for one moment: her arms, where the thing is, how it is turned and how large it is drawn. */
const GripSchema = Schema.Struct({
  armL: CurveSchema,
  armR: CurveSchema,
  layer: PoseSchema.fields.layer,
  look: LookSchema,
  /** Whether the thing stands in the room or moves with her body. */
  room: Schema.Boolean,
  thing: Schema.Tuple([
    Schema.Finite,
    Schema.Finite,
    Schema.Finite,
    Schema.Finite,
  ]),
  tilt: Schema.Finite,
});

type Grip = typeof GripSchema.Type;

/** Her right arm reaching out beside her, its tip at x, y. */
function reach(x: number, y: number): Curve {
  return [124, 146, 176, 148, 198, 154, x, y];
}

/** Every hold, for a pose that breathes and a swing between -1 and 1. */
const HOLDS: Record<
  typeof HoldSchema.Type,
  (pose: Pose, t: number, swing: number) => Grip
> = {
  apart: (_, __, swing) => ({
    armL: flip([124, 146, 158, 150, 174, 158, 182 + swing * 4, 170]),
    armR: [124, 146, 158, 150, 174, 158, 182 + swing * 4, 170],
    layer: ["back", "back"],
    look: [swing * 3, 3],
    room: false,
    thing: [102, 170, 0, 1.15],
    tilt: 0,
  }),
  beside: (pose, t, swing) => ({
    armL: sway(pose.armL, t, 0.3, 1),
    armR: reach(206, 142 + swing * 4),
    layer: ["back", "back"],
    look: [4, 2],
    room: true,
    thing: [220, 262, 0, 1.3],
    tilt: -1.5,
  }),
  chest: (pose, t, swing) => ({
    armL: sway(pose.armL, t, 0.3, 1),
    armR: [124, 146, 150, 156, 160, 176, 150 + swing * 2, 192],
    layer: ["back", "front"],
    look: [-1, 4],
    room: false,
    thing: [114 + swing * 2, 172, swing * 3, 1.2],
    tilt: 0,
  }),
  eyes: (_, __, swing) => ({
    armL: armLeft(18, 150, 26, 108, 70, 96 + swing),
    armR: flip(armLeft(18, 150, 26, 108, 70, 96 + swing)),
    layer: ["front", "front"],
    look: [swing * 3, 0],
    room: false,
    thing: [102, 88 + swing, 0, 1],
    tilt: swing * 2.5,
  }),
  front: (_, __, swing) => ({
    armL: armLeft(20, 166, 28, 220, 66, 206),
    armR: flip(armLeft(20, 166, 28, 220, 66, 206)),
    layer: ["front", "front"],
    look: [swing * 1.5, 3],
    room: false,
    thing: [102, 190, swing * 2, 1.15],
    tilt: 0,
  }),
  low: (pose, t, swing) => ({
    armL: sway(pose.armL, t, 0.3, 1),
    armR: [124, 146, 170, 168, 186, 196, 196 + swing * 5, 210],
    layer: ["back", "front"],
    look: [3, 4],
    room: false,
    thing: [196 + swing * 5, 210, swing * 4, 1.15],
    tilt: swing * 1.5,
  }),
  out: (pose, t, swing) => ({
    armL: sway(pose.armL, t, 0.3, 1),
    armR: reach(212 + swing * 3, 138),
    layer: ["back", "back"],
    look: [4, 1],
    room: false,
    thing: [212 + swing * 3, 138, swing * 7, 1.3],
    tilt: -1,
  }),
  over: (_, __, swing) => ({
    armL: armLeft(30, 168, 2, 160, -8, 128 + swing * 3),
    armR: flip(armLeft(30, 168, 2, 160, -8, 128 + swing * 3)),
    layer: ["back", "back"],
    look: [0, -3],
    room: true,
    thing: [102, -2 + swing * 2, swing * 5, 1.25],
    tilt: 0,
  }),
  throw: (pose, t, swing) => ({
    armL: sway(pose.armL, t, 0.3, 1),
    armR: [124, 146, 172, 174, 214, 162, 202 + swing * 3, 126],
    layer: ["back", "back"],
    look: [4, -2],
    room: false,
    thing: [200 + swing * 3, 114, -16 + swing * 3, 1.4],
    tilt: -1.5,
  }),
  up: (pose, t, swing) => ({
    armL: sway(pose.armL, t, 0.3, 1),
    armR: [124, 146, 196, 166, 238, 110, 208 + swing * 3, 46],
    layer: ["back", "back"],
    look: [3, -3],
    room: false,
    thing: [208 + swing * 3, 46, swing * 9, 1.3],
    tilt: -2,
  }),
};

/**
 * An act of one thing: how she has it, the thing itself, which may move with
 * the swing it is given, and her face at rest and at the top of the swing.
 * `rate` is how fast the swing goes round.
 */
export function deed(
  hold: typeof HoldSchema.Type,
  thing: (swing: number) => Parts,
  moods: readonly [rest: Mood, peak: Mood],
  rate = 2
) {
  return (t: number): Pose => {
    const pose = breathe(REST, t);
    const swing = Math.sin(t * rate);
    const grip = HOLDS[hold](pose, t, swing);
    const drawn = [turned(thing(swing), ...grip.thing)];
    return {
      ...pose,
      above: grip.room ? drawn : [],
      armL: grip.armL,
      armR: grip.armR,
      held: grip.room ? [] : drawn,
      layer: grip.layer,
      look: grip.look,
      mood: swing > 0.6 ? moods[1] : moods[0],
      tilt: pose.tilt + grip.tilt,
    };
  };
}
