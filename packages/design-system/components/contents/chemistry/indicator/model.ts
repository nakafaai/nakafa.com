import { Match, Schema } from "effect";

const PhSampleSchema = Schema.Literals([
  "hydrochloricAcid",
  "vinegar",
  "pureWater",
  "bakingSoda",
  "sodiumHydroxide",
]);

export type PhSample = typeof PhSampleSchema.Type;

const IndicatorKindSchema = Schema.Literals([
  "universal",
  "litmus",
  "phenolphthalein",
  "methylOrange",
]);

export type IndicatorKind = typeof IndicatorKindSchema.Type;

const IndicatorColorSchema = Schema.Literals([
  "red",
  "orange",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "clear",
  "yellow",
]);

const PhReadingSchema = Schema.Struct({
  colorTone: IndicatorColorSchema,
  hPlusRatio: Schema.Finite,
  ph: Schema.Finite,
});

function samplePh(sample: PhSample): number {
  return Match.value(sample).pipe(
    Match.when("hydrochloricAcid", () => 1),
    Match.when("vinegar", () => 3),
    Match.when("pureWater", () => 7),
    Match.when("bakingSoda", () => 9),
    Match.when("sodiumHydroxide", () => 13),
    Match.exhaustive
  );
}

function universalTone(ph: number): typeof IndicatorColorSchema.Type {
  if (ph <= 2) {
    return "red";
  }
  if (ph < 6) {
    return "orange";
  }
  if (ph === 7) {
    return "green";
  }
  if (ph <= 10) {
    return "teal";
  }
  return "purple";
}

/** Evaluate solution pH, relative H+ ion density, and indicator hue. */
export function evaluatePhIndicator(
  sample: PhSample,
  indicator: IndicatorKind
): typeof PhReadingSchema.Type {
  const ph = samplePh(sample);
  const colorTone: typeof IndicatorColorSchema.Type = Match.value(
    indicator
  ).pipe(
    Match.when("universal", () => universalTone(ph)),
    Match.when("litmus", () => {
      if (ph < 7) {
        return "red" as const;
      }
      if (ph > 7) {
        return "blue" as const;
      }
      return "purple" as const;
    }),
    Match.when("phenolphthalein", () =>
      ph >= 8.5 ? ("pink" as const) : ("clear" as const)
    ),
    Match.when("methylOrange", () =>
      ph <= 3.5 ? ("red" as const) : ("yellow" as const)
    ),
    Match.exhaustive
  );
  return {
    colorTone,
    hPlusRatio: Number(((14 - ph) / 14).toFixed(2)),
    ph,
  };
}
