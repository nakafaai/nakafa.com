import type { Item } from "@repo/backend/confect/island/item";
import { Array as Arr, Option, Schema } from "effect";
import {
  BRICK_BLOCK,
  GLASS_BLOCK,
  GRASS_BLOCK,
  PLANK_BLOCK,
  SAND_BLOCK,
  SLATE_BLOCK,
  SOIL_BLOCK,
  STONE_BLOCK,
  TILE_BLOCK,
} from "@/lib/island/models/blocks";
import { COTTAGE, HUT } from "@/lib/island/models/house";
import { BUSH, LAMP, ROCK, SAPLING, SEED } from "@/lib/island/models/nature";
import { POND_DEPTH, POND_STAGES } from "@/lib/island/models/pond";
import { BIG_TREE, FRUIT_TREE } from "@/lib/island/models/tree";
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

/** A drawing in one cell: a block, a bush, a rock. */
function inCell(shapes: readonly Shape[], height = 8) {
  return Option.some({
    below: 0,
    origin: [0, 0] as const,
    shapes,
    size: [8, height, 8] as const,
  });
}

/** A tree's drawing: its crown reaches a cell past its own on every side. */
function tree(shapes: readonly Shape[]) {
  return Option.some({
    below: 0,
    origin: [8, 8] as const,
    shapes,
    size: [24, 32, 24] as const,
  });
}

/**
 * Each item's drawings by stage. A stage with no drawing yet draws nothing, and
 * flowers draw as a sprite rather than voxels (ADR 0042, D28).
 */
const DRAWINGS: Record<Item, readonly Option.Option<Drawing>[]> = {
  brick: [inCell(BRICK_BLOCK)],
  bush: [inCell(BUSH)],
  flowers: [Option.none()],
  glass: [inCell(GLASS_BLOCK)],
  grass: [inCell(GRASS_BLOCK)],
  house: [
    Option.some({ below: 0, origin: [0, 0], shapes: HUT, size: [16, 14, 16] }),
    Option.some({
      below: 0,
      origin: [0, 0],
      shapes: COTTAGE,
      size: [16, 20, 16],
    }),
  ],
  lamp: [inCell(LAMP, 16)],
  planks: [inCell(PLANK_BLOCK)],
  pond: Arr.map(POND_STAGES, (shapes) =>
    Option.some({
      below: POND_DEPTH,
      origin: [0, 0] as const,
      shapes,
      size: [24, 13, 24] as const,
    })
  ),
  rock: [inCell(ROCK)],
  sand: [inCell(SAND_BLOCK)],
  slate: [inCell(SLATE_BLOCK)],
  soil: [inCell(SOIL_BLOCK)],
  stone: [inCell(STONE_BLOCK)],
  tile: [inCell(TILE_BLOCK)],
  tree: [tree(SEED), tree(SAPLING), tree(BIG_TREE), tree(FRUIT_TREE)],
};

/** The drawing of an item at a stage, none when that stage has none yet. */
export function drawingOf(item: Item, stage: number) {
  return Option.flatten(Arr.get(DRAWINGS[item], stage));
}
