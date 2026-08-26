// @vitest-environment node
import { getBacterialGrowthFrame } from "@repo/design-system/components/contents/mathematics/bacterial-growth";
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
    expect(frames[4]).toMatchObject({
      bacteriaPerDot: 100,
      gridColumns: 4,
    });
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
      bacteriaPerDot: 1,
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
      bacteriaPerDot: 1,
      gridColumns: 1,
    });
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
});
