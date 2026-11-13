import { Schema } from "effect";

/**
 * A kite's string tied to a stake. The string pulls the stake toward the
 * kite with its tension, at an angle measured from the vertical. Measured
 * from that axis, the vertical part is the adjacent side, T cos θ, and the
 * horizontal part the opposite side, T sin θ.
 */

/** The string: tension in N and length in m. */
export const LineSchema = Schema.Struct({
  length: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
  tension: Schema.Finite.pipe(Schema.check(Schema.isGreaterThan(0))),
});
export type Line = typeof LineSchema.Type;

/** The string's pull split at an angle from the vertical in degrees, in N, and where the kite flies, in m downwind and up. */
export function lineParts(line: Line, angle: number) {
  const turn = (angle * Math.PI) / 180;
  return {
    across: line.tension * Math.sin(turn),
    downwind: line.length * Math.sin(turn),
    height: line.length * Math.cos(turn),
    up: line.tension * Math.cos(turn),
  };
}
