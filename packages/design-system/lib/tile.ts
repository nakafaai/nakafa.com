import { Hash } from "effect";

/** A full turn is 360 degrees, whether it counts hues or gradient directions. */
export const TURN = 360;
/** The second tone sits this many degrees to the left or the right of the first. */
const NEIGHBOUR = 34;
const SIDES = 2;
const DIRECTIONS = 8;

/** The ground tone starts the blend, and the lighter second tone ends it. */
const GROUND_LIGHTNESS = 0.56;
const GROUND_CHROMA = 0.12;
const SECOND_LIGHTNESS = 0.66;
const SECOND_CHROMA = 0.125;

/** Writes one tone in OKLCH. */
function tone(lightness: number, chroma: number, hue: number) {
  return `oklch(${lightness} ${chroma} ${hue})`;
}

/** Wraps an angle in degrees into 0 up to 359, also when it is negative. */
export function wrap(degrees: number) {
  return ((degrees % TURN) + TURN) % TURN;
}

/**
 * Reads the hash of a seed as digits: one hue out of 360, the side of the
 * second tone, one of eight directions for the blend, and what is left, which
 * a list uses to start from one icon of a pool. `middle` is the hue halfway
 * between the two tones, which is the hue the eye takes the tile to have.
 */
export function readSeed(seed: string) {
  const hash = Math.abs(Hash.string(seed));
  const hue = hash % TURN;
  const rest = Math.floor(hash / TURN);
  const lean = rest % SIDES === 0 ? -NEIGHBOUR : NEIGHBOUR;
  const aimed = Math.floor(rest / SIDES);

  return {
    direction: aimed % DIRECTIONS,
    hue,
    lean,
    middle: wrap(hue + lean / 2),
    spin: Math.floor(aimed / DIRECTIONS),
  };
}

/**
 * The CSS background of a content tile, made from its seed.
 *
 * The hash of the seed is read as three digits: one hue out of 360, the side of
 * the second tone, 34 degrees to the left or to the right of the first, and one
 * of eight directions for the soft blend between them. The same seed always
 * gives the same tile, and lightness and chroma never change, so every tile
 * belongs to one family and a white icon stays readable on it.
 *
 * @param seed - A key that does not change with language or edits, such as an id or a path
 * @param shift - Degrees to turn the whole blend around the hue wheel, from `getTileShifts`; the seed alone gives 0
 * @returns A `linear-gradient(...)` for `background-image`
 */
export function getTileGradient(seed: string, shift = 0) {
  const { direction, hue, lean } = readSeed(seed);
  const ground = wrap(hue + shift);
  const second = wrap(ground + lean);

  return `linear-gradient(${direction * (TURN / DIRECTIONS)}deg,${tone(GROUND_LIGHTNESS, GROUND_CHROMA, ground)},${tone(SECOND_LIGHTNESS, SECOND_CHROMA, second)})`;
}
