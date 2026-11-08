import { describe, expect, it } from "@effect/vitest";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Array as Arr, Option } from "effect";
import { meshGrid } from "@/lib/island/mesh";
import { drawingOf } from "@/lib/island/models";
import { CLOUD_SHAPES, CLOUD_SIZE } from "@/lib/island/models/cloud";
import { drawModel } from "@/lib/island/voxel";

/** Every drawing in the catalog, by item and stage. */
const DRAWN = [
  ["house", 0],
  ["house", 1],
  ["tree", 2],
  ["pond", 0],
  ["pond", 1],
  ["pond", 2],
] as const;

describe("island models", () => {
  it("draws every piece the starter set holds", () => {
    for (const placement of STARTER_LAYOUT) {
      expect(Option.isSome(drawingOf(placement.item, placement.stage))).toBe(
        true
      );
    }
  });

  it("draws nothing for a stage with no drawing yet", () => {
    expect(drawingOf("tree", 0)).toEqual(Option.none());
    expect(drawingOf("house", 3)).toEqual(Option.none());
  });

  it("keeps every shape of a drawing inside its grid and leaves something to see", () => {
    const drawings = Arr.getSomes(
      Arr.map(DRAWN, ([item, stage]) => drawingOf(item, stage))
    );
    expect(drawings).toHaveLength(DRAWN.length);
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
