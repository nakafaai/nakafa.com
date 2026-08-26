// @vitest-environment node
import {
  BacterialGrowthFrameInputSchema,
  getBacterialGrowthFrame,
} from "@repo/design-system/components/contents/mathematics/bacterial-growth";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("bacterial growth frames", () => {
  it("keeps every exponential division visible for a large initial culture", () => {
    const frames = Array.from({ length: 5 }, (_, generation) =>
      getBacterialGrowthFrame({
        formulaType: "exponential",
        generation,
        initialCount: 100,
        maxGenerations: 4,
        ratio: 2,
      })
    );

    expect(frames.map((frame) => frame.bacteriaCount)).toEqual([
      100, 200, 400, 800, 1600,
    ]);
    expect(frames.map((frame) => frame.bacteriaIds.length)).toEqual([
      1, 2, 4, 8, 16,
    ]);
    expect(frames[2]?.bacteriaIds).toEqual([0, 2, 1, 3]);
    expect(frames[4]).toMatchObject({ gridColumns: 4 });
  });

  it("keeps every bounded generation visually distinct", () => {
    const visibleCounts = Array.from({ length: 11 }, (_, generation) =>
      getBacterialGrowthFrame({
        formulaType: "exponential",
        generation,
        initialCount: 1,
        maxGenerations: 10,
        ratio: 2,
      })
    ).map((frame) => frame.bacteriaIds.length);

    expect(visibleCounts).toEqual([1, 2, 4, 8, 16, 32, 64, 97, 98, 99, 100]);
  });

  it("renders one dot per bacterium while the complete culture stays bounded", () => {
    const frame = getBacterialGrowthFrame({
      formulaType: "geometric",
      generation: 3,
      initialCount: 2,
      maxGenerations: 3,
      ratio: 3,
    });

    expect(frame).toMatchObject({
      bacteriaCount: 54,
      gridColumns: 8,
    });
    expect(frame.bacteriaIds).toHaveLength(54);
    expect(new Set(frame.bacteriaIds)).toHaveProperty("size", 54);
  });

  it("removes lineages when a bounded culture decreases", () => {
    const frame = getBacterialGrowthFrame({
      formulaType: "geometric",
      generation: 3,
      initialCount: 8,
      maxGenerations: 3,
      ratio: 0.5,
    });

    expect(frame).toMatchObject({
      bacteriaCount: 1,
      bacteriaIds: [0],
      gridColumns: 1,
    });
  });

  it("renders an empty culture after its population reaches zero", () => {
    const frame = getBacterialGrowthFrame({
      formulaType: "geometric",
      generation: 2,
      initialCount: 1,
      maxGenerations: 2,
      ratio: 0.5,
    });

    expect(frame).toEqual({
      bacteriaCount: 0,
      bacteriaIds: [],
      gridColumns: 1,
    });
  });

  it("keeps a large decreasing culture visually distinct through zero", () => {
    const visibleCounts = Array.from({ length: 12 }, (_, generation) =>
      getBacterialGrowthFrame({
        formulaType: "geometric",
        generation,
        initialCount: 1000,
        maxGenerations: 11,
        ratio: 0.5,
      })
    ).map((frame) => frame.bacteriaIds.length);

    expect(visibleCounts).toEqual([100, 50, 25, 13, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it("distributes an uneven number of daughters across existing parents", () => {
    const frame = getBacterialGrowthFrame({
      formulaType: "geometric",
      generation: 1,
      initialCount: 2,
      maxGenerations: 1,
      ratio: 2.5,
    });

    expect(frame.bacteriaIds).toEqual([0, 2, 3, 1, 4]);
  });

  it("seeds visible lineages when an unvalidated caller grows from rounded zero", () => {
    const frame = getBacterialGrowthFrame({
      formulaType: "geometric",
      generation: 1,
      initialCount: 0.4,
      maxGenerations: 1,
      ratio: 10,
    });

    expect(frame).toEqual({
      bacteriaCount: 4,
      bacteriaIds: [0, 1, 2, 3],
      gridColumns: 2,
    });
  });

  it("never exceeds the visual DOM budget", () => {
    const frame = getBacterialGrowthFrame({
      formulaType: "exponential",
      generation: 8,
      initialCount: 1,
      maxGenerations: 8,
      ratio: 10,
    });

    expect(frame.bacteriaIds).toHaveLength(100);
    expect(frame.gridColumns).toBe(10);
  });

  it("rejects invalid growth inputs at the renderer boundary", () => {
    const validInput = {
      formulaType: "geometric",
      generation: 1,
      initialCount: 1,
      maxGenerations: 2,
      ratio: 2,
    };

    expect(() =>
      Schema.decodeUnknownSync(BacterialGrowthFrameInputSchema)({
        ...validInput,
        formulaType: "linear",
      })
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(BacterialGrowthFrameInputSchema)({
        ...validInput,
        initialCount: 0.4,
      })
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(BacterialGrowthFrameInputSchema)({
        ...validInput,
        generation: 3,
      })
    ).toThrow();
  });
});
