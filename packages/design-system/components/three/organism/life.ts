import { Schema } from "effect";

/**
 * The stroke a swimming or crawling body makes: a wave that starts at
 * `from` on the body's long axis and grows to `reach` at `to`, where the
 * tail or the foot ends, `turns` waves long. `axis` is the way the body
 * bends: 1 for the up and down beat of a whale's flukes, 2 for the side to
 * side sweep of a fish's tail.
 */
const StrokeSchema = Schema.Struct({
  axis: Schema.Literals([1, 2]),
  from: Schema.Finite,
  reach: Schema.Finite,
  to: Schema.Finite,
  turns: Schema.Finite,
});
export type Stroke = typeof StrokeSchema.Type;

/** How far a stroke moves the body at `x` on its long axis, at a `phase` in radians. */
function strokeAt(stroke: Stroke, x: number, phase: number) {
  const share = Math.min(
    1,
    Math.max(0, (x - stroke.from) / (stroke.to - stroke.from))
  );
  return (
    stroke.reach *
    share *
    share *
    Math.sin(phase - share * stroke.turns * 2 * Math.PI)
  );
}

/**
 * Bends a body at rest into its pose at one moment of a stroke, writing
 * into `live` and allocating nothing: every vertex moves by the stroke at
 * its own place along the body.
 */
export function strokeInto(
  rest: Float32Array,
  live: Float32Array,
  stroke: Stroke,
  phase: number
) {
  for (let at = 0; at < rest.length; at += 3) {
    live[at + stroke.axis] =
      Number(rest[at + stroke.axis]) +
      strokeAt(stroke, Number(rest[at]), phase);
  }
}

/**
 * How much fuller than at rest a breathing chest or a pulsing bell is at a
 * `phase` in radians: it fills quickly and empties slowly, between 1 and
 * `1 + depth`.
 */
export function breathAt(phase: number, depth: number) {
  const beat = 0.5 + 0.5 * Math.sin(phase);
  return 1 + depth * beat * beat * (3 - 2 * beat);
}
