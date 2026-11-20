import { Schema } from "effect";
import type { Land } from "@/lib/island/land/ground";
import { coverAt, depthAt, slopeAt } from "@/lib/island/land/ground";

/**
 * What a footstep of the learner's fox sounds like, by what its paw lands on
 * (ADR 0047, D40): soft grass, hissing sand, the dull soil of a forest floor,
 * the crunching gravel of a path, the hollow board of a bridge, the hard
 * stone of a rock face, or the splash of water it wades or swims in.
 */
export const Footing = Schema.Literals([
  "grass",
  "sand",
  "soil",
  "gravel",
  "wood",
  "stone",
  "water",
]);
export type Footing = typeof Footing.Type;

/** How deep water stands before a paw splashes in it instead of treading the ground, in blocks: about 3 cm. */
const WET = 0.03;

/** How steep the ground is before it shows bare rock under a paw: a rise of 0.75 blocks over one block. */
const ROCK = 0.75;

/**
 * What the fox's paws land on at a place of the land (ADR 0050, W1): water
 * where it wades or swims, then a painted or worn path, sand, rock where the
 * ground is too steep to hold turf, the floor of a forest, and grass for open
 * ground and meadow alike.
 */
export function footingAt(land: Land, x: number, z: number): Footing {
  if (depthAt(land, x, z) > WET) {
    return "water";
  }
  const cover = coverAt(land, x, z);
  if (cover === "path") {
    return "gravel";
  }
  if (cover === "sand") {
    return "sand";
  }
  if (slopeAt(land, x, z) > ROCK) {
    return "stone";
  }
  return cover === "forest" ? "soil" : "grass";
}
