import { Match, Schema } from "effect";

const TrophicScenarioSchema = Schema.Literals([
  "balanced",
  "removePredator",
  "algalBloom",
  "overharvest",
]);

export type TrophicScenario = typeof TrophicScenarioSchema.Type;

const TrophicStateSchema = Schema.Struct({
  primaryKj: Schema.Finite,
  producerKj: Schema.Finite,
  secondaryKj: Schema.Finite,
  tertiaryKj: Schema.Finite,
});

/** Compute four-tier trophic energy pyramid values (kJ) under each ecosystem scenario. */
export function evaluateTrophicPyramid(
  scenario: TrophicScenario,
  energyInputKj: number
): typeof TrophicStateSchema.Type {
  const base = Math.max(100, energyInputKj);
  return Match.value(scenario).pipe(
    Match.when("balanced", () => ({
      primaryKj: base * 0.1,
      producerKj: base,
      secondaryKj: base * 0.01,
      tertiaryKj: base * 0.001,
    })),
    Match.when("removePredator", () => ({
      primaryKj: base * 0.16,
      producerKj: base * 0.72,
      secondaryKj: base * 0.014,
      tertiaryKj: 0,
    })),
    Match.when("algalBloom", () => ({
      primaryKj: base * 0.05,
      producerKj: base * 1.45,
      secondaryKj: base * 0.004,
      tertiaryKj: base * 0.0004,
    })),
    Match.when("overharvest", () => ({
      primaryKj: base * 0.04,
      producerKj: base * 0.55,
      secondaryKj: base * 0.003,
      tertiaryKj: base * 0.0002,
    })),
    Match.exhaustive
  );
}
