import { Match, Schema } from "effect";

const HalogenPairSchema = Schema.Literals([
  "cl2WithKbr",
  "cl2WithKi",
  "br2WithKi",
  "i2WithKcl",
]);

export type HalogenPair = typeof HalogenPairSchema.Type;

const LayerColorSchema = Schema.Literals(["clear", "amber", "violet", "pale"]);

const DisplacementOutcomeSchema = Schema.Struct({
  aqueousTone: LayerColorSchema,
  displaced: Schema.Boolean,
  organicTone: LayerColorSchema,
});

/** Determine aqueous and cyclohexane organic-layer hues for halogen-halide mixtures. */
export function evaluateHalogenDisplacement(
  pair: HalogenPair
): typeof DisplacementOutcomeSchema.Type {
  return Match.value(pair).pipe(
    Match.when("cl2WithKbr", () => ({
      aqueousTone: "amber" as const,
      displaced: true,
      organicTone: "amber" as const,
    })),
    Match.when("cl2WithKi", () => ({
      aqueousTone: "amber" as const,
      displaced: true,
      organicTone: "violet" as const,
    })),
    Match.when("br2WithKi", () => ({
      aqueousTone: "amber" as const,
      displaced: true,
      organicTone: "violet" as const,
    })),
    Match.when("i2WithKcl", () => ({
      aqueousTone: "pale" as const,
      displaced: false,
      organicTone: "violet" as const,
    })),
    Match.exhaustive
  );
}
