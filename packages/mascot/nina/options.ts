import { POP } from "@repo/mascot/color";
import { ACTS, ActSchema } from "@repo/mascot/nina/act";
import { LeanSchema, SideSchema } from "@repo/mascot/nina/body";
import { EDGES, EdgeSchema } from "@repo/mascot/nina/edge";
import { LookSchema, MoodSchema } from "@repo/mascot/nina/face";
import type { Pose } from "@repo/mascot/nina/pose";
import { Record as Rec, Schema } from "effect";

/** The colors that can lie behind her in a tile. */
const GroundSchema = Schema.Literals(Rec.keys(POP));

const Shared = {
  look: Schema.optionalKey(LookSchema),
  mood: Schema.optionalKey(MoodSchema),
  side: Schema.optionalKey(SideSchema),
  t: Schema.optionalKey(Schema.Finite),
};

/**
 * What the drawing needs to know. Whole, she is drawn doing `act`. Otherwise
 * she is the same figure seen through a smaller window, the way the profile
 * animals are: she rises from the bottom of the frame, standing in the middle
 * or leaning in from a lower corner (`lean`: right, left), and the frame cuts
 * her body, never her head. `lean: "peek"` is her looking over the bottom edge
 * with the tips of her arms resting on it. `side: "left"` mirrors her, fin and
 * all. `t` picks the moment of the act; left out, it is the moment that shows
 * the act best. `fidget` lists the acts that she may do for a moment by
 * herself, now and then, when she is alive.
 */
const OptionsSchema = Schema.Union([
  Schema.Struct({
    ...Shared,
    act: Schema.optionalKey(ActSchema),
    fidget: Schema.optionalKey(Schema.Array(ActSchema)),
    whole: Schema.Literal(true),
  }),
  Schema.Struct({
    ...Shared,
    act: Schema.optionalKey(EdgeSchema),
    fidget: Schema.optionalKey(Schema.Array(EdgeSchema)),
    lean: Schema.optionalKey(LeanSchema),
    tile: Schema.optionalKey(GroundSchema),
    whole: Schema.optionalKey(Schema.Literal(false)),
  }),
]);

export type Options = typeof OptionsSchema.Type;

/**
 * How much of her shows: all of her, her arms over an edge, or only her face in
 * a tile. It decides what is drawn and what moves.
 */
const ModeSchema = Schema.Literals(["whole", "peek", "tile"]);

export type Mode = typeof ModeSchema.Type;

/**
 * The way she is shown, which only the options decide. This is the one place
 * that knows she looks over an edge when she leans `peek`, and every other
 * module asks for the mode.
 */
export function modeOf(options: Options): Mode {
  if (options.whole === true) {
    return "whole";
  }
  return options.lean === "peek" ? "peek" : "tile";
}

/** An act of the whole figure, or one over an edge. */
export const BehaviorSchema = Schema.Union([ActSchema, EdgeSchema]);

/** Every act she does, whole or over an edge. The two sets have no name in common. */
export const BEHAVIORS = { ...ACTS, ...EDGES };

/** The act that she goes back to: the one she is given, or the one that suits how she is shown. */
export function homeOf(options: Options): typeof BehaviorSchema.Type {
  return options.whole === true
    ? (options.act ?? "relaxed")
    : (options.act ?? "gripping");
}

/**
 * The face she shows, in a still picture and while she lives: the one a press
 * shows for a moment, else the one the options ask for, else the one her act
 * has at that moment, else hello. Over an edge or in a tile too, so the still
 * picture and the first frame of her life have the same face.
 */
export function moodOf(
  options: Options,
  act: Pose,
  glad?: typeof MoodSchema.Type
) {
  return glad ?? options.mood ?? act.mood ?? "hello";
}
