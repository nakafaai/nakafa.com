import { Match, Schema } from "effect";

const ActivityStateSchema = Schema.Literals([
  "rest",
  "exercise",
  "highAltitude",
]);

export type ActivityState = typeof ActivityStateSchema.Type;

const GasExchangeReadingSchema = Schema.Struct({
  diffusionIndex: Schema.Finite,
  oxygenUptakeMlPerMin: Schema.Finite,
  pO2GradientMmHg: Schema.Finite,
});

/** Compute alveolar O2 partial pressure gradient and uptake from activity state and ventilation rate. */
export function evaluateAlveolusExchange(
  state: ActivityState,
  ventilationBpm: number
): typeof GasExchangeReadingSchema.Type {
  const rate = Math.max(4, ventilationBpm);
  return Match.value(state).pipe(
    Match.when("rest", () => ({
      diffusionIndex: Number((rate / 12).toFixed(2)),
      oxygenUptakeMlPerMin: Math.round(250 * (rate / 12)),
      pO2GradientMmHg: 60,
    })),
    Match.when("exercise", () => ({
      diffusionIndex: Number(((rate / 12) * 1.45).toFixed(2)),
      oxygenUptakeMlPerMin: Math.round(420 * (rate / 12)),
      pO2GradientMmHg: 78,
    })),
    Match.when("highAltitude", () => ({
      diffusionIndex: Number(((rate / 12) * 0.65).toFixed(2)),
      oxygenUptakeMlPerMin: Math.round(180 * (rate / 12)),
      pO2GradientMmHg: 34,
    })),
    Match.exhaustive
  );
}
