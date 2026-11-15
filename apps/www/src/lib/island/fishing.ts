import { Array as Arr, Result, Schema } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import { unitOf } from "@/lib/island/noise";

/** How far from the fox a line reaches, in cells. */
export const REACH = 9;

/** How long a bite lasts before the fish gets away, in seconds. */
export const BITE = 1.1;

/**
 * One cast in the water (ADR 0047, D13): where the float sits, when it was
 * cast, and when a fish bites, in seconds of the game's clock.
 */
export const Cast = Schema.Struct({
  at: Schema.Finite,
  bite: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
export type Cast = typeof Cast.Type;

/** The species a line can catch: every animal that lives in the sea. */
const CATCHES = Arr.filter(
  Arr.makeBy(SPECIES.length, (index) => index),
  (index) => SPECIES[index].home === "sea"
);

/**
 * A cast into a water cell from the fox at (x, z): a float on the water and a
 * bite one and a half to four and a half seconds later, or "far" when the
 * water is out of the line's reach.
 */
export function castOf(
  fox: readonly [number, number],
  water: readonly [number, number, number],
  seed: number,
  casts: number,
  now: number
) {
  const distance = Math.hypot(water[0] + 0.5 - fox[0], water[2] + 0.5 - fox[1]);
  if (distance > REACH) {
    return Result.fail("far" as const);
  }
  return Result.succeed<Cast>({
    at: now,
    bite: now + 1.5 + unitOf(seed, casts, 41, 7) * 3,
    x: water[0] + 0.5,
    y: water[1] + 0.95,
    z: water[2] + 0.5,
  });
}

/** What reeling in at `now` brings: nothing yet, a fish while it bites, or nothing once it got away. */
export function reelOf(cast: Cast, now: number) {
  if (now < cast.bite) {
    return "early" as const;
  }
  return now <= cast.bite + BITE ? ("caught" as const) : ("escaped" as const);
}

/** The species a catch brings, from the island's seed and how many casts came before. */
export function catchOf(seed: number, casts: number) {
  return CATCHES[Math.floor(unitOf(seed, casts, 43, 11) * CATCHES.length)];
}

/** How far the float dips under at `now`: still while it waits, bobbing hard while a fish bites. */
export function dipOf(cast: Cast, now: number) {
  if (now >= cast.bite && now <= cast.bite + BITE) {
    return -0.18 + Math.sin(now * 30) * 0.06;
  }
  return Math.sin((now - cast.at) * 3) * 0.03;
}
