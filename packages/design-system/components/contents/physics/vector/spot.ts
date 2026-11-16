import { Schema } from "effect";

/** A point on a vector sketch's canvas, in pixels. */
const SpotSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});
export type Spot = typeof SpotSchema.Type;
