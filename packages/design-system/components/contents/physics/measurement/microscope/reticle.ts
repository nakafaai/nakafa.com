import { Schema } from "effect";

/**
 * A hair under a microscope with a scale in its eyepiece. The eyepiece scale
 * is calibrated against a stage micrometer for each objective, so one
 * division covers 25 µm at 4x, 10 µm at 10x and 2.5 µm at 40x. Counting the
 * divisions across the hair to a tenth of a division gives its diameter;
 * a stronger objective spreads the hair over more divisions, so the count
 * carries more significant figures.
 */

/** The hair's true diameter, in micrometres. */
export const HAIR_DIAMETER = 68.04;

/** How many divisions the eyepiece scale carries. */
export const RETICLE_DIVISIONS = 100;

/** The objectives, each with the width of one eyepiece division, in micrometres. */
export const ObjectiveSchema = Schema.Literals(["low", "medium", "high"]);
export const OBJECTIVES = {
  high: { division: 2.5, power: 40 },
  low: { division: 25, power: 4 },
  medium: { division: 10, power: 10 },
} as const;

/**
 * The reading through `objective`: the divisions across the hair to a tenth,
 * the diameter that count gives in micrometres, and how many significant
 * figures the count supports.
 */
export function hairReading(objective: typeof ObjectiveSchema.Type) {
  const { division } = OBJECTIVES[objective];
  const divisions = Math.round((HAIR_DIAMETER / division) * 10) / 10;
  const figures = Math.floor(Math.log10(divisions)) + 2;
  return { diameter: divisions * division, divisions, figures };
}
