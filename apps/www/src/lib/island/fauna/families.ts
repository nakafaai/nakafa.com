import { Schema } from "effect";

/** What sets one species apart within its family: its ears, tail, horns, and a mane or crest. */
export const Traits = Schema.Struct({
  crest: Schema.Boolean,
  ears: Schema.Literals(["point", "round", "long", "none"]),
  horns: Schema.Literals(["none", "horns", "antlers", "tusks"]),
  tail: Schema.Literals(["long", "bushy", "short", "none"]),
});
export type Traits = typeof Traits.Type;

/**
 * Every family of the catalog, each with one builder of its 3D model (ADR
 * 0047, D21 and D25): the four-legged beasts by their build (small, rodent,
 * hoof, heavy, tall, elephant), the primates, the birds by how they stand
 * (songbird, waterbird, wader, perch), the swimmers (fish, eel, ray, turtle),
 * the reptiles and the frog, and the small ones of the flowers and the shore
 * (butterfly, beetle, bee, crab, snail).
 */
export const Family = Schema.Literals([
  "small",
  "rodent",
  "hoof",
  "heavy",
  "tall",
  "elephant",
  "primate",
  "songbird",
  "waterbird",
  "wader",
  "perch",
  "fish",
  "eel",
  "ray",
  "turtle",
  "lizard",
  "snake",
  "frog",
  "butterfly",
  "beetle",
  "bee",
  "crab",
  "snail",
]);
export type Family = typeof Family.Type;
