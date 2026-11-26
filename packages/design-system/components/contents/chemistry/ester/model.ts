import { Match, Schema } from "effect";

const EsterIdSchema = Schema.Literals([
  "ethylEthanoate",
  "propylEthanoate",
  "butylEthanoate",
]);

export type EsterId = typeof EsterIdSchema.Type;

const RefluxReadingSchema = Schema.Struct({
  boilingPointC: Schema.Int,
  esterLayerRatio: Schema.Finite,
  refluxing: Schema.Boolean,
});

/** Evaluate ester reflux condensation rate and immiscible ester-layer formation. */
export function evaluateEsterReflux(
  ester: EsterId,
  temperatureC: number
): typeof RefluxReadingSchema.Type {
  const boilingPointC = Match.value(ester).pipe(
    Match.when("ethylEthanoate", () => 77),
    Match.when("propylEthanoate", () => 102),
    Match.when("butylEthanoate", () => 126),
    Match.exhaustive
  );
  const clamped = Math.min(100, Math.max(20, temperatureC));
  return {
    boilingPointC,
    esterLayerRatio: Number(
      Math.min(1, Math.max(0.1, (clamped - 25) / 65)).toFixed(2)
    ),
    refluxing: clamped >= 60,
  };
}
