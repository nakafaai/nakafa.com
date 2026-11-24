import { Array as Arr, Schema } from "effect";

const DynamicSystemSchema = Schema.Literals([
  "generic",
  "nitrogenDioxide",
  "hydrogenIodide",
]);
export type DynamicSystem = typeof DynamicSystemSchema.Type;

const EquilibriumStateSchema = Schema.Literals(["approaching", "balanced"]);
export type EquilibriumState = typeof EquilibriumStateSchema.Type;

const KineticsSnapshotSchema = Schema.Struct({
  equilibriumRatio: Schema.Finite,
  forwardRate: Schema.Finite,
  productConcentration: Schema.Finite,
  reactantConcentration: Schema.Finite,
  reverseRate: Schema.Finite,
  state: EquilibriumStateSchema,
});

const RateSampleSchema = Schema.Struct({
  forward: Schema.Finite,
  reverse: Schema.Finite,
  time: Schema.Finite,
});

export const MAX_SIMULATION_TIME = 12;

/**
 * Evaluates reversible first-order kinetics A <-> B at elapsed time `seconds`
 * from initial reactant concentration `initialReactant` and rate constants
 * `kf` (forward) and `kr` (reverse).
 */
export function evaluateDynamic(
  initialReactant: number,
  kf: number,
  kr: number,
  seconds: number
): typeof KineticsSnapshotSchema.Type {
  const sum = kf + kr;
  const clampedTime = Math.max(0, seconds);
  const eqReactant = (initialReactant * kr) / sum;
  const decay = Math.exp(-sum * clampedTime);
  const reactantConcentration =
    eqReactant + (initialReactant - eqReactant) * decay;
  const productConcentration = Math.max(
    0,
    initialReactant - reactantConcentration
  );
  const forwardRate = kf * reactantConcentration;
  const reverseRate = kr * productConcentration;
  const gap = Math.abs(forwardRate - reverseRate);
  const initialForward = Math.max(0.01, kf * initialReactant);
  const state: EquilibriumState =
    gap / initialForward < 0.06 ? "balanced" : "approaching";
  return {
    equilibriumRatio: Math.round((kf / kr) * 100) / 100,
    forwardRate: Math.round(forwardRate * 100) / 100,
    productConcentration: Math.round(productConcentration * 100) / 100,
    reactantConcentration: Math.round(reactantConcentration * 100) / 100,
    reverseRate: Math.round(reverseRate * 100) / 100,
    state,
  };
}

/** Samples forward and reverse rate curves across [0, MAX_SIMULATION_TIME]. */
export function sampleRateCurves(
  initialReactant: number,
  kf: number,
  kr: number,
  steps = 32
): readonly (typeof RateSampleSchema.Type)[] {
  return Arr.makeBy(steps + 1, (index) => {
    const time = (MAX_SIMULATION_TIME * index) / steps;
    const snap = evaluateDynamic(initialReactant, kf, kr, time);
    return {
      forward: snap.forwardRate,
      reverse: snap.reverseRate,
      time,
    };
  });
}
