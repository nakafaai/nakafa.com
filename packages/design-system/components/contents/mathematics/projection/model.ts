import { Match, Schema } from "effect";

const DotPresetSchema = Schema.Literals(["acute", "orthogonal", "obtuse"]);

export type DotPreset = typeof DotPresetSchema.Type;

const DotMetricsSchema = Schema.Struct({
  dotProduct: Schema.Finite,
  presetAngleDeg: Schema.Finite,
  projectionLength: Schema.Finite,
});

/** Return the representative angle in degrees for a dot-product preset. */
export function presetDotAngle(preset: DotPreset): number {
  return Match.value(preset).pipe(
    Match.when("acute", () => 40),
    Match.when("orthogonal", () => 90),
    Match.when("obtuse", () => 135),
    Match.exhaustive
  );
}

/** Evaluate dot product u . v and signed scalar projection for |u| = 1.5, |v| = 2.0. */
export function evaluateDotProjection(
  angleDeg: number
): typeof DotMetricsSchema.Type {
  const rad = (angleDeg * Math.PI) / 180;
  const dot = 1.5 * 2 * Math.cos(rad);
  const proj = 1.5 * Math.cos(rad);
  return {
    dotProduct: Number(dot.toFixed(2)),
    presetAngleDeg: angleDeg,
    projectionLength: Number(proj.toFixed(2)),
  };
}
