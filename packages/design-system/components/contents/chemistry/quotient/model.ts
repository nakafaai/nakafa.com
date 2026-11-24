import { Match, Schema } from "effect";

const StoichiometrySchema = Schema.Literals([
  "oneToOne",
  "oneToTwo",
  "twoToTwo",
]);
export type Stoichiometry = typeof StoichiometrySchema.Type;

const QuotientDirectionSchema = Schema.Literals([
  "forward",
  "equilibrium",
  "reverse",
]);
export type QuotientDirection = typeof QuotientDirectionSchema.Type;

const QuotientSnapshotSchema = Schema.Struct({
  direction: QuotientDirectionSchema,
  qc: Schema.Finite,
  tiltRad: Schema.Finite,
});

const EQUILIBRIUM_TOLERANCE = 0.05;

/**
 * Computes reaction quotient Q_c, predicted shift direction relative to K_c,
 * and balance-beam tilt angle for a chosen stoichiometry.
 */
export function evaluateQuotient(
  reactant: number,
  product: number,
  kc: number,
  stoichiometry: Stoichiometry
): typeof QuotientSnapshotSchema.Type {
  const safeReactant = Math.max(0.01, reactant);
  const rawQc = Match.value(stoichiometry).pipe(
    Match.when("oneToOne", () => product / safeReactant),
    Match.when("oneToTwo", () => (product * product) / safeReactant),
    Match.when(
      "twoToTwo",
      () => (product * product) / (safeReactant * safeReactant)
    ),
    Match.exhaustive
  );
  const qc = Math.round(rawQc * 100) / 100;
  const relativeDiff = Math.abs(rawQc - kc) / kc;
  let direction: QuotientDirection = "equilibrium";
  if (relativeDiff > EQUILIBRIUM_TOLERANCE) {
    direction = rawQc < kc ? "forward" : "reverse";
  }
  const logRatio = Math.log(Math.max(0.02, rawQc) / kc);
  const tiltRad = Math.tanh(logRatio * 0.7) * 0.34;
  return { direction, qc, tiltRad };
}
