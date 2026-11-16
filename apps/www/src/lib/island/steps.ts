import { type BlockKey, keyOf } from "@repo/backend/confect/island/blocks";
import { Array as Arr, Option, Schema } from "effect";
import { standOf } from "@/lib/island/path";
import { blockAt, type Cells } from "@/lib/island/world";

/**
 * What a footstep of the learner's fox sounds like, by what its paw lands on
 * (ADR 0047, D40): soft grass, hissing sand, dull soil, crunching gravel, a
 * hollow board or a hard stone. The fox never stands in water.
 */
export const Footing = Schema.Literals([
  "grass",
  "sand",
  "soil",
  "gravel",
  "wood",
  "stone",
]);
export type Footing = typeof Footing.Type;

/** How far the fox walks between two footsteps, in cells: a trot of about seven steps a second at its walking speed. */
export const STRIDE = 0.45;

/** The blocks each footing is heard on; any other floor is heard as stone. */
const HEARD = [
  ["grass", ["grass", "leaves", "wool"]],
  ["sand", ["sand"]],
  ["soil", ["dirt", "farmland", "wet-farmland"]],
  ["gravel", ["path"]],
  ["wood", ["log", "planks", "bookshelf"]],
] as const satisfies readonly (readonly [Footing, readonly BlockKey[]])[];

/** What a foot on a block sounds like. */
export function footingOf(key: BlockKey) {
  return Option.getOrElse(
    Option.map(
      Arr.findFirst(HEARD, ([, keys]) => Arr.contains<BlockKey>(keys, key)),
      ([footing]) => footing
    ),
    (): Footing => "stone"
  );
}

/** What the fox's paws land on at (x, z): the floor it stands on there, none where it cannot stand. */
export function footingAt(cells: Cells, x: number, z: number) {
  const column = [Math.floor(x), Math.floor(z)] as const;
  return Option.map(
    Option.flatMap(standOf(cells, column[0], column[1]), (feet) =>
      keyOf(blockAt(cells, column[0], feet - 1, column[1]))
    ),
    footingOf
  );
}
