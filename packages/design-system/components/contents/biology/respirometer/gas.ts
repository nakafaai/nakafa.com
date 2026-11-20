import { Array as Arr, Match, Schema } from "effect";

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

/**
 * How long the coloured index drop is in the capillary, in millimetres: about
 * 2 cm of food dye (Pearson Edexcel AS and A level Biology B, Core Practical
 * 9, respirometer technician sheet, 2016).
 */
export const DROP_LENGTH = 20;

/** How far the scale runs on past the farthest reading, in millimetres, so a drop never sits at its very end. */
const SCALE_MARGIN = 5;

/**
 * The stretch of the scale behind each capillary, in millimetres from where
 * the drops' leading edges start (zero), counted positive towards the seeds:
 * from a round ten behind the drop's tail, or behind a drop that backs away
 * from the seeds, to a round ten past the farthest drop. The carbon dioxide
 * is never negative, so the drop over potassium hydroxide always travels
 * farthest.
 */
export function scaleSpan(oxygen: number, carbonDioxide: number) {
  const back = Math.min(0, oxygen - carbonDioxide);
  return {
    back,
    from: Math.floor((back - DROP_LENGTH - SCALE_MARGIN) / 10) * 10,
    to: Math.ceil((oxygen + SCALE_MARGIN) / 10) * 10,
  };
}

/**
 * The readings the scale numbers, every `step` millimetres from the step at
 * or behind `back` (zero, or behind a drop that backs away) to `to`.
 */
export function scaleNumbers(back: number, to: number, step: number) {
  return Arr.map(
    Arr.range(Math.floor(back / step), Math.floor(to / step)),
    (index) => index * step
  );
}

/**
 * How deep a liquid of `volume` cubic metres stands in a round-bottomed tube
 * of inner radius `radius` metres, from the inside of its foot. The foot is a
 * hemisphere holding 2/3 π r³; above it the liquid fills a cylinder, π r²
 * per metre. Below that the liquid is a spherical cap of height h holding
 * π h² (3r − h) / 3, solved for h by halving the interval.
 */
export function fillDepth(volume: number, radius: number) {
  const bowl = (2 / 3) * Math.PI * radius ** 3;
  if (volume >= bowl) {
    return radius + (volume - bowl) / (Math.PI * radius ** 2);
  }
  const start: readonly [number, number] = [0, radius];
  const [low, high] = Arr.reduce(
    Arr.range(1, 48),
    start,
    ([lower, upper]): readonly [number, number] => {
      const middle = (lower + upper) / 2;
      const held = (Math.PI * middle ** 2 * (3 * radius - middle)) / 3;
      return held < volume ? [middle, upper] : [lower, middle];
    }
  );
  return (low + high) / 2;
}

/**
 * A general-purpose laboratory thermometer, −10 to 110 °C, 305 mm long
 * (Scientific Laboratory Supplies THE1080; Eisco PH0470B with a white enamel
 * back): the share of its graduated length the red spirit fills at
 * `celsius`.
 */
export function thermometerShare(celsius: number) {
  return (celsius + 10) / 120;
}
