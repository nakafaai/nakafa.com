import { describe, expect, it } from "@effect/vitest";
import {
  clockFigure,
  SEGMENTS,
  segmentBars,
  segmentLit,
} from "@repo/design-system/components/three/instrument/segments";
import { Array as Arr } from "effect";

/** How many segments a figure darkens. */
function darkened(figure: number) {
  return Arr.filter(Arr.range(0, SEGMENTS - 1), (segment) =>
    segmentLit(figure, segment)
  ).length;
}

describe("seven-segment display", () => {
  it("darkens the segments of each figure", () => {
    expect(darkened(1)).toBe(2);
    expect(darkened(7)).toBe(3);
    expect(darkened(8)).toBe(7);
    expect(segmentLit(0, 6)).toBe(false);
    expect(segmentLit(1, 1)).toBe(true);
    expect(segmentLit(1, 0)).toBe(false);
  });

  it("reads a time to its hundredth, place by place", () => {
    const figures = Arr.makeBy(5, (place) => clockFigure(77.94, place));

    expect(figures).toEqual([1, 1, 7, 9, 4]);
    expect(clockFigure(17.946, 4)).toBe(5);
    expect(clockFigure(0, 2)).toBe(0);
  });

  it("lays the seven bars of a figure inside its box", () => {
    const bars = segmentBars({ tall: 10, thick: 1, wide: 5 });

    expect(bars).toHaveLength(SEGMENTS);
    expect(bars[0].at).toEqual([0, 4.5]);
    expect(bars[3].at).toEqual([0, -4.5]);
    expect(bars[1].at).toEqual([2, 2.5]);
    expect(bars[4].at).toEqual([-2, -2.5]);
    expect(bars[6].size).toEqual([3.5, 1]);
  });
});
