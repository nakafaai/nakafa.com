import { Array as Arr, Match, Schema } from "effect";

const RectifierModeSchema = Schema.Literals([
  "halfWave",
  "fullWave",
  "smoothed",
]);

export type RectifierMode = typeof RectifierModeSchema.Type;

const RectifierReadingSchema = Schema.Struct({
  activeDiodes: Schema.Int,
  dcAverage: Schema.Finite,
  ripplePercent: Schema.Int,
});

const WaveSampleSchema = Schema.Struct({
  input: Schema.Finite,
  output: Schema.Finite,
  phase: Schema.Finite,
});

/** Compute instantaneous rectified output voltage normalized by peak voltage. */
export function rectifiedOutput(mode: RectifierMode, phaseRad: number): number {
  const input = Math.sin(phaseRad);
  return Match.value(mode).pipe(
    Match.when("halfWave", () => Math.max(0, input)),
    Match.when("fullWave", () => Math.abs(input)),
    Match.when("smoothed", () => {
      const rect = Math.abs(input);
      const decay = 0.78 + 0.22 * rect;
      return Math.max(rect, decay);
    }),
    Match.exhaustive
  );
}

/** Evaluate active diode count, DC average voltage, and ripple percentage. */
export function evaluateRectifier(
  mode: RectifierMode,
  peakVoltage: number,
  frequencyHz: number
): typeof RectifierReadingSchema.Type {
  const safePeak = Math.max(0.1, peakVoltage);
  const safeFreq = Math.max(1, frequencyHz);
  return Match.value(mode).pipe(
    Match.when("halfWave", () => ({
      activeDiodes: 1,
      dcAverage: safePeak / Math.PI,
      ripplePercent: 100,
    })),
    Match.when("fullWave", () => ({
      activeDiodes: 2,
      dcAverage: (2 * safePeak) / Math.PI,
      ripplePercent: 48,
    })),
    Match.when("smoothed", () => {
      const ripple = Math.max(4, Math.min(28, Math.round(600 / safeFreq)));
      return {
        activeDiodes: 2,
        dcAverage: safePeak * (1 - ripple / 200),
        ripplePercent: ripple,
      };
    }),
    Match.exhaustive
  );
}

/** Sample two full AC cycles for synchronized oscilloscope plotting. */
export function sampleRectifierWave(
  mode: RectifierMode,
  steps = 48
): readonly (typeof WaveSampleSchema.Type)[] {
  const count = Math.max(8, Math.round(steps));
  return Arr.makeBy(count + 1, (index) => {
    const phase = (index / count) * Math.PI * 4;
    return {
      input: Math.sin(phase),
      output: rectifiedOutput(mode, phase),
      phase,
    };
  });
}
