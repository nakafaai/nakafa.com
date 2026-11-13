import { Schema } from "effect";

/**
 * A coin and a feather dropped together in a tall glass tube, first full of
 * air, then pumped empty. Without air both fall with the same acceleration
 * and land together, as David Scott showed with a hammer and a feather on
 * the Moon (Apollo 15, 2 August 1971). With air the coin still falls almost
 * freely, while drag holds the feather to a slow, steady settling speed.
 * Gravity is rounded to 10 m/s², as the lessons do.
 */

/** Gravitational acceleration, in m/s². */
export const TUBE_GRAVITY = 10;

/** How far the two fall inside the tube, in metres. */
export const TUBE_DROP = 1.1;

/**
 * The feather's settling speed in air, in m/s: a model value. Loose feathers
 * settle at a few tenths of a metre per second; the card states the value it
 * uses, so the times it reads follow from it.
 */
export const FEATHER_SETTLING = 0.5;

/** What fills the tube. */
export const TubeAirSchema = Schema.Literals(["air", "vacuum"]);
export type TubeAir = typeof TubeAirSchema.Type;

/** How far a freely falling body has dropped after `time` seconds, never past the bottom. */
function freeDrop(time: number) {
  return Math.min(0.5 * TUBE_GRAVITY * Math.max(time, 0) ** 2, TUBE_DROP);
}

/**
 * How far the feather has dropped after `time` seconds in air: drag growing
 * with speed brings it to its settling speed within a few hundredths of a
 * second, after which it falls steadily.
 */
function featherDrop(time: number) {
  const t = Math.max(time, 0);
  const rate = TUBE_GRAVITY / FEATHER_SETTLING;
  return Math.min(
    FEATHER_SETTLING * t -
      (FEATHER_SETTLING / rate) * (1 - Math.exp(-rate * t)),
    TUBE_DROP
  );
}

/** How far the coin and the feather have dropped after `time` seconds. */
export function tubeDrops(air: TubeAir, time: number) {
  return {
    coin: freeDrop(time),
    feather: air === "vacuum" ? freeDrop(time) : featherDrop(time),
  };
}

/** How long each takes to reach the bottom, in seconds. */
export function tubeTimes(air: TubeAir) {
  const coin = Math.sqrt((2 * TUBE_DROP) / TUBE_GRAVITY);
  if (air === "vacuum") {
    return { coin, feather: coin };
  }
  const rate = TUBE_GRAVITY / FEATHER_SETTLING;
  return {
    coin,
    feather: (TUBE_DROP + FEATHER_SETTLING / rate) / FEATHER_SETTLING,
  };
}
