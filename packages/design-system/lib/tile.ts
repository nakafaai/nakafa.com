import { Hash } from "effect";

/** A full turn is 360 degrees, whether it counts hues or gradient directions. */
const TURN = 360;
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
 * @returns A `linear-gradient(...)` for `background-image`
 */
export function getTileGradient(seed: string) {
  const hash = Math.abs(Hash.string(seed));
  const hue = hash % TURN;
  const rest = Math.floor(hash / TURN);
  const side = rest % SIDES === 0 ? TURN - NEIGHBOUR : NEIGHBOUR;
  const direction = Math.floor(rest / SIDES) % DIRECTIONS;
  const ground = tone(GROUND_LIGHTNESS, GROUND_CHROMA, hue);
  const second = tone(SECOND_LIGHTNESS, SECOND_CHROMA, (hue + side) % TURN);

  return `linear-gradient(${direction * (TURN / DIRECTIONS)}deg,${ground},${second})`;
}
