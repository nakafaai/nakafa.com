import { Array as Arr, Schema } from "effect";

/**
 * One reading of the Hydrilla experiment: the lamp's distance from the plant
 * in centimetres, the gas bubbles the cut stem gives off in a minute, and
 * whether sodium hydrogen carbonate was added to give extra carbon dioxide.
 */
const ReadingSchema = Schema.Struct({
  bicarbonate: Schema.optionalKey(Schema.Boolean),
  bubbles: Schema.Finite,
  distance: Schema.Finite,
});
export type Reading = typeof ReadingSchema.Type;

/**
 * How bright the lamp is at the plant compared with the farthest lamp of the
 * experiment: light spreads over a sphere, so intensity falls with the square
 * of the distance, I ∝ 1 / d².
 */
export function relativeIntensity(distance: number, farthest: number) {
  return (farthest / distance) ** 2;
}

/** The farthest lamp distance among the readings, in centimetres. */
export function farthestDistance(readings: readonly [Reading, ...Reading[]]) {
  return Arr.reduce(readings, readings[0].distance, (far, reading) =>
    Math.max(far, reading.distance)
  );
}

/**
 * The seconds between two bubbles leaving the stem at `bubbles` a minute.
 * The scene plays them at this pace, so the count a learner makes over a
 * minute is the reading.
 */
export function bubbleInterval(bubbles: number) {
  return 60 / bubbles;
}

/** How far a bubble has risen, in centimetres, `seconds` after it left the stem, rising at `speed` centimetres a second. */
export function bubbleRise(seconds: number, speed: number) {
  return seconds * speed;
}

/**
 * The bubbles of one reading in the water at `time` seconds: how far each has
 * risen, newest first, while it is still below the surface `height`
 * centimetres above the stem.
 */
export function bubblesAt(
  bubbles: number,
  time: number,
  speed: number,
  height: number
) {
  const interval = bubbleInterval(bubbles);
  const count = Math.ceil(height / (speed * interval));
  const latest = time % interval;
  return Arr.filter(
    Arr.map(Arr.range(0, count), (index) =>
      bubbleRise(latest + index * interval, speed)
    ),
    (rise) => rise <= height
  );
}
