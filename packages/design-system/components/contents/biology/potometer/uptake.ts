import { Schema } from "effect";

/**
 * Which leaf surfaces of a shoot carry petroleum jelly: none, the lower
 * surfaces, the upper surfaces, or both. Jelly seals the stomata and the
 * cuticle it covers, so no water leaves through that surface.
 */
const CoatSchema = Schema.Literals(["none", "lower", "upper", "both"]);

/**
 * One leafy shoot in the potometer: the surfaces its jelly covers, the name
 * the lab's toggle shows for it, and the water it takes up, in cubic
 * centimetres an hour.
 */
const ShootSchema = Schema.Struct({
  coat: CoatSchema,
  name: Schema.String,
  rate: Schema.Finite,
});
export type Shoot = typeof ShootSchema.Type;

/** How long the graduated capillary is, in centimetres, before the reservoir resets the bubble. */
export const SCALE_LENGTH = 30;

/** The area of the capillary's bore, in square centimetres, for a bore radius `radius` in millimetres. */
export function boreArea(radius: number) {
  return Math.PI * (radius / 10) ** 2;
}

/** The water a shoot taking up `rate` cubic centimetres an hour draws in `minutes`, in cubic centimetres. */
export function uptakeAfter(rate: number, minutes: number) {
  return (rate * minutes) / 60;
}

/**
 * How far the air bubble has moved along a capillary of bore radius `radius`
 * millimetres after `minutes`, in centimetres: the water drawn in fills a
 * cylinder of the bore, so the bubble moves V / (π r²).
 */
export function bubbleTravel(rate: number, radius: number, minutes: number) {
  return uptakeAfter(rate, minutes) / boreArea(radius);
}

/**
 * Where the bubble stands on the scale, in centimetres from its start. When it
 * reaches the end of the scale the reservoir's tap pushes it back to the
 * start, so it runs again from zero.
 */
export function bubbleMark(travel: number) {
  return travel % SCALE_LENGTH;
}
