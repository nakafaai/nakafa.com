import { Match, Schema } from "effect";

const ReactionEnthalpySchema = Schema.Literals(["exothermic", "endothermic"]);

export type ReactionEnthalpy = typeof ReactionEnthalpySchema.Type;

const CatalystStateSchema = Schema.Literals(["absent", "present"]);

export type CatalystState = typeof CatalystStateSchema.Type;

const CatalystProfileSchema = Schema.Struct({
  activationEnergyKj: Schema.Finite,
  enthalpyChangeKj: Schema.Finite,
  productHeight: Schema.Finite,
  reactantHeight: Schema.Finite,
  uncatalysedPeakHeight: Schema.Finite,
  catalysedPeakHeight: Schema.Finite,
});

/**
 * Evaluate activation energy and invariant enthalpy change for uncatalysed and
 * catalysed alternative reaction pathways.
 */
export function evaluateCatalyst(
  reaction: ReactionEnthalpy,
  catalyst: CatalystState
): typeof CatalystProfileSchema.Type {
  return Match.value(reaction).pipe(
    Match.when("exothermic", () => ({
      activationEnergyKj: catalyst === "present" ? 45 : 95,
      catalysedPeakHeight: 0.92,
      enthalpyChangeKj: -60,
      productHeight: 0.34,
      reactantHeight: 0.66,
      uncatalysedPeakHeight: 1.24,
    })),
    Match.when("endothermic", () => ({
      activationEnergyKj: catalyst === "present" ? 75 : 125,
      catalysedPeakHeight: 1.02,
      enthalpyChangeKj: 55,
      productHeight: 0.72,
      reactantHeight: 0.34,
      uncatalysedPeakHeight: 1.32,
    })),
    Match.exhaustive
  );
}
