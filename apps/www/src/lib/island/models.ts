import type { Item } from "@repo/backend/confect/island/item";
import { Array as Arr, Option, Schema } from "effect";
import { COTTAGE, HUT } from "@/lib/island/models/house";
import { POND_DEPTH, POND_STAGES } from "@/lib/island/models/pond";
import { BIG_TREE } from "@/lib/island/models/tree";
import { Shape } from "@/lib/island/voxel";

/**
 * How one item at one stage is drawn: its voxel grid's size, where the corner of
 * its first footprint cell lies in that grid (a tree's crown reaches past its
 * cell), how far below the grass the grid starts (a pond starts at its floor),
 * and its shapes.
 */
const Drawing = Schema.Struct({
  below: Schema.Int,
  origin: Schema.Tuple([Schema.Int, Schema.Int]),
  shapes: Schema.Array(Shape),
  size: Schema.Tuple([Schema.Int, Schema.Int, Schema.Int]),
});
type Drawing = typeof Drawing.Type;

/** Each item's drawings by stage; a stage with no drawing yet draws nothing. */
const DRAWINGS: Record<Item, readonly Option.Option<Drawing>[]> = {
  house: [
    Option.some({ below: 0, origin: [0, 0], shapes: HUT, size: [16, 14, 16] }),
    Option.some({
      below: 0,
      origin: [0, 0],
      shapes: COTTAGE,
      size: [16, 20, 16],
    }),
  ],
  pond: Arr.map(POND_STAGES, (shapes) =>
    Option.some({
      below: POND_DEPTH,
      origin: [0, 0] as const,
      shapes,
      size: [24, 13, 24] as const,
    })
  ),
  tree: [
    Option.none(),
    Option.none(),
    Option.some({
      below: 0,
      origin: [8, 8],
      shapes: BIG_TREE,
      size: [24, 32, 24],
    }),
  ],
};

/** The drawing of an item at a stage, none when that stage has none yet. */
export function drawingOf(item: Item, stage: number) {
  return Option.flatten(Arr.get(DRAWINGS[item], stage));
}
