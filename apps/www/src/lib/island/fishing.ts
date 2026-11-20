import { Array as Arr, Option, Result, Schema } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import type { Land } from "@/lib/island/land/ground";
import {
  depthAt,
  elevationAt,
  flowAt,
  surfaceAt,
} from "@/lib/island/land/ground";
import { unitOf } from "@/lib/island/noise";

/** How far from the fox a line reaches, in blocks. */
export const REACH = 9;

/** How long a bite lasts before the fish gets away, in seconds. */
export const BITE = 1.1;

/** How deep water must stand to take a float, in blocks: deeper than a wade of 27 cm. */
export const WADE = 0.3;

/** The elevation under which water is the sea's, in blocks over the sea: the land's own shore line (ADR 0050, W1). */
const SHORE = 0.3;

/** The waters a line is cast into: the sea, a river that flows, and a lake or a pond that stands still. */
export const Water = Schema.Literals(["sea", "river", "lake"]);
export type Water = typeof Water.Type;

/**
 * One cast in the water (ADR 0047, D15): where the float sits, which water
 * that is, when it was cast, and when a fish bites, in seconds of the game's
 * clock.
 */
export const Cast = Schema.Struct({
  at: Schema.Finite,
  bite: Schema.Finite,
  water: Water,
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});
export type Cast = typeof Cast.Type;

/** The species of fresh water, by their keys: the ones that swim a river, and the ones that keep to still water. */
const FRESH = {
  lake: ["goldfish", "koi", "tilapia", "catfish", "carp", "betta", "gourami"],
  river: ["tilapia", "catfish", "carp", "arowana", "gourami", "salmon", "eel"],
} as const;

/** The species a line can catch, by their place in the catalog, whose key a test accepts. */
function speciesWhere(test: (key: string, home: string) => boolean) {
  return Arr.filter(
    Arr.makeBy(SPECIES.length, (index) => index),
    (index) => test(SPECIES[index].key, SPECIES[index].home)
  );
}

/**
 * What each water holds: a river and a lake their own fish, and the sea every
 * animal that lives in it but the ones of fresh water.
 */
const CATCHES = {
  lake: speciesWhere((key) => Arr.contains<string>(FRESH.lake, key)),
  river: speciesWhere((key) => Arr.contains<string>(FRESH.river, key)),
  sea: speciesWhere(
    (key, home) =>
      home === "sea" &&
      !Arr.contains<string>(FRESH.lake, key) &&
      !Arr.contains<string>(FRESH.river, key)
  ),
} as const;

/** Which water lies at a place, none where the ground is dry or the water too shallow for a float. */
export function waterAt(land: Land, x: number, z: number) {
  if (depthAt(land, x, z) <= WADE) {
    return Option.none();
  }
  if (elevationAt(land, x, z) <= SHORE) {
    return Option.some<Water>("sea");
  }
  const [across, deep] = flowAt(land, x, z);
  return Option.some<Water>(across === 0 && deep === 0 ? "lake" : "river");
}

/**
 * A cast to the place the learner pressed, from the fox at (x, z): a float on
 * the water's face there and a bite one and a half to four and a half seconds
 * later, or "far" when the place is out of the line's reach or holds no water
 * deep enough.
 */
export function castOf(
  land: Land,
  fox: readonly [number, number],
  pressed: readonly [number, number],
  casts: number,
  now: number
) {
  const water = waterAt(land, pressed[0], pressed[1]);
  if (
    Option.isNone(water) ||
    Math.hypot(pressed[0] - fox[0], pressed[1] - fox[1]) > REACH
  ) {
    return Result.fail("far" as const);
  }
  return Result.succeed<Cast>({
    at: now,
    bite: now + 1.5 + unitOf(land.seed, casts, 41, 7) * 3,
    water: water.value,
    x: pressed[0],
    y: surfaceAt(land, pressed[0], pressed[1]),
    z: pressed[1],
  });
}

/** What reeling in at `now` brings: nothing yet, a fish while it bites, or nothing once it got away. */
export function reelOf(cast: Cast, now: number) {
  if (now < cast.bite) {
    return "early" as const;
  }
  return now <= cast.bite + BITE ? ("caught" as const) : ("escaped" as const);
}

/** The species a catch brings from a water, from the land's seed and how many casts came before. */
export function catchOf(seed: number, casts: number, water: Water) {
  const held = CATCHES[water];
  return held[Math.floor(unitOf(seed, casts, 43, 11) * held.length)];
}

/** How far the float dips under at `now`: still while it waits, bobbing hard while a fish bites. */
export function dipOf(cast: Cast, now: number) {
  if (now >= cast.bite && now <= cast.bite + BITE) {
    return -0.18 + Math.sin(now * 30) * 0.06;
  }
  return Math.sin((now - cast.at) * 3) * 0.03;
}
