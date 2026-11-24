import { Array as Arr, Match, Schema } from "effect";

const PlantLifeCycleSchema = Schema.Literals([
  "annual",
  "biennial",
  "perennial",
]);

export type PlantLifeCycle = typeof PlantLifeCycleSchema.Type;

const GrowthPhaseSchema = Schema.Literals([
  "lag",
  "exponential",
  "slowing",
  "stationary",
  "senescence",
]);

export type GrowthPhase = typeof GrowthPhaseSchema.Type;

const GrowthSampleSchema = Schema.Struct({
  dryMass: Schema.Finite,
  phase: GrowthPhaseSchema,
  rate: Schema.Finite,
  time: Schema.Finite,
});

type GrowthSample = typeof GrowthSampleSchema.Type;

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function dryMassAt(lifeCycle: PlantLifeCycle, time: number): number {
  const t = Math.min(100, Math.max(0, time));
  return Match.value(lifeCycle).pipe(
    Match.when("annual", () => {
      const growth = sigmoid((t - 42) / 10);
      const decay = t > 82 ? 0.16 * ((t - 82) / 18) ** 1.4 : 0;
      return Math.max(0.04, 0.05 + 0.92 * growth - decay);
    }),
    Match.when("biennial", () => {
      const season1 = 0.44 * sigmoid((t - 22) / 6);
      const winterDip =
        t > 38 && t < 56 ? 0.07 * Math.sin(((t - 38) / 18) * Math.PI) : 0;
      const season2 = 0.52 * sigmoid((t - 68) / 6);
      const decay = t > 88 ? 0.15 * ((t - 88) / 12) ** 1.3 : 0;
      return Math.max(0.05, 0.05 + season1 - winterDip + season2 - decay);
    }),
    Match.when("perennial", () => {
      const s1 = 0.3 * sigmoid((t - 16) / 4.5);
      const s2 = 0.32 * sigmoid((t - 48) / 4.5);
      const s3 = 0.32 * sigmoid((t - 78) / 4.5);
      return 0.06 + s1 + s2 + s3;
    }),
    Match.exhaustive
  );
}

function classifyPhase(
  lifeCycle: PlantLifeCycle,
  t: number,
  rate: number
): GrowthPhase {
  if (lifeCycle !== "perennial" && t >= 86) {
    return "senescence";
  }
  if (t < 18) {
    return "lag";
  }
  if (rate >= 0.011) {
    return "exponential";
  }
  if (rate >= 0.004) {
    return "slowing";
  }
  return "stationary";
}

/** Evaluate normalized dry mass, instantaneous growth rate, and sigmoid phase at time t in [0, 100]. */
export function evaluateGrowthCurve(
  lifeCycle: PlantLifeCycle,
  time: number
): GrowthSample {
  const clamped = Math.min(100, Math.max(0, time));
  const dryMass = dryMassAt(lifeCycle, clamped);
  const dt = 0.5;
  const before = dryMassAt(lifeCycle, Math.max(0, clamped - dt));
  const after = dryMassAt(lifeCycle, Math.min(100, clamped + dt));
  const span = Math.min(100, clamped + dt) - Math.max(0, clamped - dt);
  const rate = (after - before) / span;
  const phase = classifyPhase(lifeCycle, clamped, rate);
  return { dryMass, phase, rate, time: clamped };
}

/** Sample the full growth curve across [0, 100] for SVG plotting. */
export function sampleGrowthCurve(
  lifeCycle: PlantLifeCycle,
  steps = 40
): readonly GrowthSample[] {
  const count = Math.max(4, Math.round(steps));
  return Arr.makeBy(count + 1, (index) =>
    evaluateGrowthCurve(lifeCycle, (index / count) * 100)
  );
}
