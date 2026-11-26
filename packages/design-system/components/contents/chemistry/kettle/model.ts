import { Match, Schema } from "effect";

const SaponificationStepSchema = Schema.Literals([
  "hydrolysis",
  "saltingOut",
  "filtration",
  "molding",
]);

export type SaponificationStep = typeof SaponificationStepSchema.Type;

const KettleStateSchema = Schema.Struct({
  curdHeight: Schema.Finite,
  hasBrine: Schema.Boolean,
  isMolded: Schema.Boolean,
});

/** Model soap-curd precipitation and molding progression inside a saponification kettle. */
export function evaluateSaponificationStep(
  step: SaponificationStep
): typeof KettleStateSchema.Type {
  return Match.value(step).pipe(
    Match.when("hydrolysis", () => ({
      curdHeight: 0.12,
      hasBrine: false,
      isMolded: false,
    })),
    Match.when("saltingOut", () => ({
      curdHeight: 0.28,
      hasBrine: true,
      isMolded: false,
    })),
    Match.when("filtration", () => ({
      curdHeight: 0.42,
      hasBrine: true,
      isMolded: false,
    })),
    Match.when("molding", () => ({
      curdHeight: 0.48,
      hasBrine: false,
      isMolded: true,
    })),
    Match.exhaustive
  );
}
