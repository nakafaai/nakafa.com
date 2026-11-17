import { Match, Schema } from "effect";

/**
 * The two respirometers of the experiment: one with potassium hydroxide
 * solution, which absorbs every bit of carbon dioxide the seeds give off, and
 * one with water in its place.
 */
const TubeSchema = Schema.Literals(["potash", "water"]);
export type Tube = typeof TubeSchema.Type;

/**
 * The respiratory substrate a respiratory quotient points to: fat near 0.7,
 * protein near 0.9, carbohydrate at 1.0, and above 1 some respiration that
 * runs without oxygen.
 */
const SubstrateSchema = Schema.Literals([
  "fat",
  "protein",
  "carbohydrate",
  "anaerobic",
]);
export type Substrate = typeof SubstrateSchema.Type;

/**
 * How far the coloured liquid has moved towards the seeds in one tube after
 * `minutes` of the `total`, in millimetres, when over the whole run the seeds
 * take in oxygen worth `oxygen` mm of the capillary and give off carbon
 * dioxide worth `carbonDioxide` mm. With potassium hydroxide the carbon
 * dioxide is absorbed, so only the oxygen taken in pulls the liquid; with
 * water the carbon dioxide stays as gas and pushes back. A negative value
 * moves the liquid away from the seeds.
 */
export function dropTravel(
  tube: Tube,
  oxygen: number,
  carbonDioxide: number,
  minutes: number,
  total: number
) {
  const share = minutes / total;
  return Match.value(tube).pipe(
    Match.when("potash", () => oxygen * share),
    Match.when("water", () => (oxygen - carbonDioxide) * share),
    Match.exhaustive
  );
}

/** The respiratory quotient: the carbon dioxide released over the oxygen taken in. */
export function quotient(oxygen: number, carbonDioxide: number) {
  return carbonDioxide / oxygen;
}

/** The substrate a respiratory quotient points to, at the nearest of the textbook values. */
export function substrateOf(value: number): Substrate {
  if (value > 1.05) {
    return "anaerobic";
  }
  if (value >= 0.95) {
    return "carbohydrate";
  }
  return value >= 0.8 ? "protein" : "fat";
}
