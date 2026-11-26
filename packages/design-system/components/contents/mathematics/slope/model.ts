import { Match, Schema } from "effect";

const SlopeCurveSchema = Schema.Literals([
  "cubicWave",
  "quarticWell",
  "dampedSine",
]);

export type SlopeCurve = typeof SlopeCurveSchema.Type;

const SlopeProbeSchema = Schema.Struct({
  derivative: Schema.Finite,
  direction: Schema.Literals(["increasing", "decreasing", "stationary"]),
  value: Schema.Finite,
});

/** Evaluate f(x) and f'(x) at probe x along the chosen derivative field curve. */
export function evaluateSlopeField(
  curve: SlopeCurve,
  x: number
): typeof SlopeProbeSchema.Type {
  const { d, y } = Match.value(curve).pipe(
    Match.when("cubicWave", () => ({
      d: 0.72 * x * x - 0.85,
      y: 0.24 * x * x * x - 0.85 * x + 0.9,
    })),
    Match.when("quarticWell", () => ({
      d: 0.48 * x * x * x - 1.1 * x,
      y: 0.12 * x * x * x * x - 0.55 * x * x + 1.05,
    })),
    Match.when("dampedSine", () => ({
      d: 0.8 * Math.cos(1.4 * x) * 1.4,
      y: 0.8 * Math.sin(1.4 * x) + 0.95,
    })),
    Match.exhaustive
  );

  let direction: "decreasing" | "increasing" | "stationary" = "stationary";
  if (d > 0.05) {
    direction = "increasing";
  } else if (d < -0.05) {
    direction = "decreasing";
  }

  return {
    derivative: Number(d.toFixed(2)),
    direction,
    value: Number(y.toFixed(2)),
  };
}
