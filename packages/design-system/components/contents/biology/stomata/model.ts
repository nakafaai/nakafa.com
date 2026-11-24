import { Match, Schema } from "effect";

const StomataConditionSchema = Schema.Literals(["light", "dark", "drought"]);

export type StomataCondition = typeof StomataConditionSchema.Type;

const ApertureStateSchema = Schema.Literals(["open", "narrow", "closed"]);

export type ApertureState = typeof ApertureStateSchema.Type;

const TurgorStateSchema = Schema.Literals(["turgid", "flaccid"]);

export type TurgorState = typeof TurgorStateSchema.Type;

const StomataReadingSchema = Schema.Struct({
  aperture: ApertureStateSchema,
  co2Percent: Schema.Int,
  openFraction: Schema.Finite,
  transpirationPercent: Schema.Int,
  turgor: TurgorStateSchema,
});

export type StomataReading = typeof StomataReadingSchema.Type;

function classifyAperture(openFraction: number): ApertureState {
  if (openFraction >= 0.55) {
    return "open";
  }
  if (openFraction >= 0.18) {
    return "narrow";
  }
  return "closed";
}

/** Evaluate guard-cell turgor, pore opening, CO2 intake, and transpiration. */
export function evaluateStomata(
  condition: StomataCondition,
  lightValue: number,
  lightMin: number,
  lightMax: number
): StomataReading {
  const span = Math.max(1e-6, lightMax - lightMin);
  const normalizedLight = Math.min(
    1,
    Math.max(0, (lightValue - lightMin) / span)
  );

  const openFraction = Match.value(condition).pipe(
    Match.when("light", () => 0.12 + normalizedLight * 0.88),
    Match.when("dark", () => 0.04),
    Match.when("drought", () => 0.02),
    Match.exhaustive
  );

  const aperture = classifyAperture(openFraction);
  const turgor: TurgorState = openFraction >= 0.18 ? "turgid" : "flaccid";
  const co2Percent = Math.round(openFraction * 100);
  const transpirationPercent = Match.value(condition).pipe(
    Match.when("light", () => Math.round(openFraction * 95)),
    Match.when("dark", () => 6),
    Match.when("drought", () => 3),
    Match.exhaustive
  );

  return {
    aperture,
    co2Percent,
    openFraction,
    transpirationPercent,
    turgor,
  };
}
