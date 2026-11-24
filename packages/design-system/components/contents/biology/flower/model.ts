import { Schema } from "effect";

const PollinationModeSchema = Schema.Literals(["insect", "wind"]);

export type PollinationMode = typeof PollinationModeSchema.Type;

const FlowerTraitsSchema = Schema.Struct({
  filamentLength: Schema.Finite,
  petalScale: Schema.Finite,
  pollenSize: Schema.Finite,
  stigmaFeatherSpread: Schema.Finite,
});

/** Compare insect-pollinated and wind-pollinated floral geometry. */
export function evaluatePollinationTraits(
  mode: PollinationMode
): typeof FlowerTraitsSchema.Type {
  if (mode === "insect") {
    return {
      filamentLength: 0.44,
      petalScale: 1,
      pollenSize: 0.048,
      stigmaFeatherSpread: 0.08,
    };
  }
  return {
    filamentLength: 0.72,
    petalScale: 0.42,
    pollenSize: 0.024,
    stigmaFeatherSpread: 0.24,
  };
}
