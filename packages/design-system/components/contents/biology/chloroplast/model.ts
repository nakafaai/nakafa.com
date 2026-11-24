import { Schema } from "effect";

const ChloroplastStageSchema = Schema.Literals([
  "lightDependent",
  "calvinCycle",
  "compensation",
]);

export type ChloroplastStage = typeof ChloroplastStageSchema.Type;

const LimitingFactorSchema = Schema.Literals([
  "light",
  "co2",
  "temperature",
  "balanced",
]);

export type LimitingFactor = typeof LimitingFactorSchema.Type;

const GasStateSchema = Schema.Literals([
  "netRelease",
  "compensation",
  "netUptake",
]);

export type GasState = typeof GasStateSchema.Type;

const ChloroplastReadingSchema = Schema.Struct({
  gasState: GasStateSchema,
  limitingFactor: LimitingFactorSchema,
  photosynthesisRate: Schema.Finite,
  respirationRate: Schema.Finite,
});

export type ChloroplastReading = typeof ChloroplastReadingSchema.Type;

function normalize(value: number, min: number, max: number): number {
  const span = Math.max(1e-6, max - min);
  return Math.min(1, Math.max(0, (value - min) / span));
}

function classifyFactor(
  lightScore: number,
  co2Score: number,
  tempScore: number
): LimitingFactor {
  const minScore = Math.min(lightScore, co2Score, tempScore);
  if (minScore >= 0.72) {
    return "balanced";
  }
  if (tempScore <= lightScore && tempScore <= co2Score) {
    return "temperature";
  }
  if (lightScore <= co2Score) {
    return "light";
  }
  return "co2";
}

function classifyGas(netRate: number): GasState {
  if (netRate > 0.08) {
    return "netRelease";
  }
  if (netRate < -0.08) {
    return "netUptake";
  }
  return "compensation";
}

/**
 * Evaluate photosynthesis rate, respiration baseline, limiting factor, and net
 * gas exchange from normalized light, CO2, and temperature inputs.
 */
export function evaluateChloroplast(input: {
  readonly co2: number;
  readonly co2Max: number;
  readonly co2Min: number;
  readonly light: number;
  readonly lightMax: number;
  readonly lightMin: number;
  readonly temperature: number;
  readonly temperatureMax: number;
  readonly temperatureMin: number;
}): ChloroplastReading {
  const lightNorm = normalize(input.light, input.lightMin, input.lightMax);
  const co2Norm = normalize(input.co2, input.co2Min, input.co2Max);
  const tempNorm = normalize(
    input.temperature,
    input.temperatureMin,
    input.temperatureMax
  );
  // Bell-shaped enzyme response peaking around 65% of the temperature slider
  const tempScore = Math.max(0.05, 1 - ((tempNorm - 0.65) / 0.55) ** 2);

  const limitingFactor = classifyFactor(lightNorm, co2Norm, tempScore);
  const photosynthesisRate = Math.min(lightNorm, co2Norm, tempScore);
  const respirationRate = 0.22 + tempNorm * 0.14;
  const gasState = classifyGas(photosynthesisRate - respirationRate);

  return {
    gasState,
    limitingFactor,
    photosynthesisRate,
    respirationRate,
  };
}
