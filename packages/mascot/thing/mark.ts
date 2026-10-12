import { Schema } from "effect";

/**
 * The small things a thing can do by itself. A line draws itself, a pencil
 * writes, a shackle opens, dots type, balls hop, a glint blinks, a ribbon
 * sways, a hand ticks, a flag waves and a plane glides.
 */
const MotionSchema = Schema.Literals([
  "draw",
  "write",
  "open",
  "dot",
  "hop",
  "glint",
  "sway",
  "tick",
  "wave",
  "glide",
]);

/**
 * What a shape of a thing does by itself, and, in seconds, how long its
 * start is shifted: a negative delay starts the motion part way through.
 */
const MarkSchema = Schema.Struct({
  delay: Schema.optionalKey(Schema.Finite),
  motion: MotionSchema,
});

/** What a shape of a thing does by itself. */
export type Mark = typeof MarkSchema.Type;
