import { describe, expect, it } from "@effect/vitest";
import { growsOf, Item, stagesOf } from "@repo/backend/confect/island/item";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Array as Arr, Option } from "effect";
import { meshGrid } from "@/lib/island/mesh";
import { drawingOf } from "@/lib/island/models";
import { CLOUD_SHAPES, CLOUD_SIZE } from "@/lib/island/models/cloud";
import { drawModel } from "@/lib/island/voxel";

/** Every item and stage of the catalog. */
/** Every stage of every item: the stages it can be bought at, and a plant's grown ones. */
const STAGES = Arr.flatMap(Item.literals, (item) =>
  Arr.makeBy(
    Option.match(growsOf(item), {
      onNone: () => stagesOf(item).length,
      onSome: ({ days }) => days.length + 1,
    }),
    (stage) => [item, stage] as const
  )
);

describe("island models", () => {
  it("draws every piece the starter set holds", () => {
    for (const placement of STARTER_LAYOUT) {
      expect(Option.isSome(drawingOf(placement.item, placement.stage))).toBe(
        true
      );
    }
  });

  it("draws nothing for a stage with no drawing yet", () => {
    expect(drawingOf("flowers", 0)).toEqual(Option.none());
    expect(drawingOf("house", 3)).toEqual(Option.none());
  });

  it("keeps every shape of a drawing inside its grid and leaves something to see", () => {
    const drawings = Arr.getSomes(
      Arr.map(STAGES, ([item, stage]) => drawingOf(item, stage))
    );
    expect(drawings.length).toBeGreaterThan(15);
    for (const drawing of drawings) {
      const grid = drawModel(drawing.size, drawing.shapes);
      const filled = Arr.reduce(
        Arr.fromIterable(grid.cells),
        0,
        (count, value) => (value === 0 ? count : count + 1)
      );
      expect(filled > 0 || drawing.shapes.length === 0).toBe(true);
    }
  });

  it("draws a cloud of soft puffs", () => {
    const cloud = meshGrid(drawModel(CLOUD_SIZE, CLOUD_SHAPES, 5));
    expect(cloud.indices.length).toBeGreaterThan(0);
  });
});
