import { Array as Arr, Result, Schema } from "effect";
import type { Family } from "@/lib/island/fauna/families";
import { SPECIES } from "@/lib/island/fauna/species";
import { unitOf } from "@/lib/island/noise";

/** One species of the catalogue. */
type Species = (typeof SPECIES)[number];

/** The species of the catalogue a role takes, by their indexes, in the catalogue's order. */
function rosterOf(fits: (species: Species) => boolean) {
  return Arr.filterMap(SPECIES, (species, index) =>
    fits(species) ? Result.succeed(index) : Result.failVoid
  );
}

/** Whether a species is of one of these families. */
function ofFamily(species: Species, families: readonly Family[]) {
  return Arr.contains(families, species.family);
}

/** Whether a species is one of these, by its key. */
function named(species: Species, keys: readonly string[]) {
  return Arr.contains(keys, species.key);
}

/** The grazers of the high terraces, which keep to the cold and the rock. */
const HIGH = [
  "goat",
  "sheep",
  "llama",
  "alpaca",
  "reindeer",
  "moose",
  "antelope",
];

/** The fish of rivers and lakes. */
const FRESH = [
  "koi",
  "goldfish",
  "tilapia",
  "catfish",
  "carp",
  "gourami",
  "arowana",
  "betta",
  "salmon",
];

/** The waterbirds of rivers and lakes; the others keep to the sea. */
const PONDS = ["duck", "goose", "swan", "teal-duck"];

/** The fish that school over a reef every day, and the one that keeps to an anemone (ADR 0047, D50). */
const REEF = ["blue-tang", "snapper", "angelfish"];

/** What visits a reef alone: rays, eels, a grouper, a puffer, a sea snake and a lobster on its floor. */
const LURKERS = [
  "stingray",
  "flounder",
  "eel",
  "moray",
  "grouper",
  "pufferfish",
  "sea-snake",
  "lobster",
];

/** The fish that shoal in the open sea, and the manta that glides through it. */
const PELAGIC = [
  "tuna",
  "mackerel",
  "milkfish",
  "barracuda",
  "needlefish",
  "manta",
];

/**
 * Who lives where (ADR 0047, D11; ADR 0050, W9), each role as the indexes of
 * its species: the herds of the meadow and the open grass, the grazers of the
 * highland, the forest's climbers and its prowlers, the small ones that keep
 * to the ground, the shore's crabs, its waders and its other visitors, the
 * ponds' fowl and fish, the reef's schools, its turtles and its lurkers, the
 * open sea's shoals and its floating birds, the birds of the sky, the raptors
 * and the perchers among them, and the visitors of the flowers.
 */
export const CAST = {
  bloom: rosterOf((species) => species.home === "bloom"),
  climbers: rosterOf((species) => species.family === "primate"),
  clown: rosterOf((species) => species.key === "clownfish"),
  crabs: rosterOf(
    (species) => species.family === "crab" && species.home === "shore"
  ),
  creepers: rosterOf(
    (species) =>
      species.home === "land" &&
      ofFamily(species, ["lizard", "snake", "frog", "turtle", "perch"])
  ),
  fowl: rosterOf((species) => named(species, PONDS)),
  fresh: rosterOf((species) => named(species, FRESH)),
  herds: rosterOf(
    (species) =>
      species.home === "land" &&
      ofFamily(species, ["hoof", "tall", "elephant"]) &&
      !named(species, HIGH)
  ),
  highland: rosterOf((species) => named(species, HIGH)),
  lurkers: rosterOf((species) => named(species, LURKERS)),
  mackerel: rosterOf((species) => species.key === "mackerel"),
  pelagic: rosterOf((species) => named(species, PELAGIC)),
  perchers: rosterOf(
    (species) => species.home === "sky" && species.family === "perch"
  ),
  prowlers: rosterOf(
    (species) =>
      species.home === "land" && ofFamily(species, ["small", "heavy", "rodent"])
  ),
  reef: rosterOf((species) => named(species, REEF)),
  seabirds: rosterOf(
    (species) => species.family === "waterbird" && !named(species, PONDS)
  ),
  shore: rosterOf(
    (species) =>
      species.home === "shore" && !ofFamily(species, ["crab", "wader"])
  ),
  sky: rosterOf((species) => species.home === "sky"),
  turtles: rosterOf(
    (species) => species.family === "turtle" && species.home === "sea"
  ),
  waders: rosterOf((species) => species.family === "wader"),
} as const;

/** What decides who lives in one cell of the land (ADR 0050, W9): the seed, the cell and the day. */
export const Dice = Schema.Struct({
  day: Schema.Int,
  gx: Schema.Int,
  gz: Schema.Int,
  seed: Schema.Int,
});
export type Dice = typeof Dice.Type;

/**
 * The species a role gives one cell, by the seed, the cell and a turn of the
 * dice (ADR 0050, W9): a resident rolls with turn 0 and is the same every
 * day, a visitor rolls with the day and changes with it. None for a role no
 * species of the catalogue takes.
 */
export function castOf(role: keyof typeof CAST, dice: Dice, turn: number) {
  const roster = CAST[role];
  return Arr.get(
    roster,
    Math.floor(
      unitOf(dice.seed + 401 + turn * 7, dice.gx, roster.length, dice.gz) *
        roster.length
    )
  );
}

/** How many of a species keep together, by its height in blocks: many small ones, a few large ones, never fewer than two nor more than `most`. */
export function packSize(index: number, most: number) {
  return Math.min(
    most,
    Math.max(2, Math.round(4.5 / Math.max(0.5, SPECIES[index].height)))
  );
}
