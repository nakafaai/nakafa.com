import { describe, expect, it } from "@effect/vitest";
import { sampleRippleCells } from "@repo/design-system/lib/block-art/ripple";

const GRID = {
  columnCount: 4,
  rowCount: 4,
  ripple: { startTime: 100, x: 1, y: 1 },
  waveDuration: 600,
};

describe("block-art ripple sampling", () => {
  it("starts at the clicked cell without lighting cells beyond the wave", () => {
    expect(sampleRippleCells({ ...GRID, currentTime: 100 })).toEqual([[5, 1]]);
  });

  it("moves outward and fades while keeping every sample within the grid", () => {
    const cells = sampleRippleCells({ ...GRID, currentTime: 200 });
    const intensities = new Map(cells);
    expect(intensities.has(5)).toBe(false);
    expect(intensities.get(1)).toBeCloseTo(5 / 6);
    expect(intensities.get(4)).toBeCloseTo(5 / 6);
    expect(intensities.get(6)).toBeCloseTo(5 / 6);
    expect(intensities.get(9)).toBeCloseTo(5 / 6);
    expect(
      cells.every(
        ([index, intensity]) =>
          index >= 0 && index < 16 && intensity > 0 && intensity < 1
      )
    ).toBe(true);
  });

  it("clips corner waves and returns no cells once their energy expires", () => {
    expect(
      sampleRippleCells({
        ...GRID,
        currentTime: 100,
        ripple: { startTime: 100, x: 0, y: 0 },
      })
    ).toEqual([[0, 1]]);
    expect(sampleRippleCells({ ...GRID, currentTime: 700 })).toEqual([]);
    expect(sampleRippleCells({ ...GRID, currentTime: 900 })).toEqual([]);
  });
});
