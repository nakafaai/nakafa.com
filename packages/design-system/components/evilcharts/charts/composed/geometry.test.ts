import { describe, expect, it } from "@effect/vitest";
import { barRectangle } from "@repo/design-system/components/evilcharts/charts/composed/geometry";

describe("the rectangle a composed chart's bar paints", () => {
  it("keeps a bar above the zero line as Recharts measured it, growing from its bottom", () => {
    expect(barRectangle({ height: 120, width: 24, x: 40, y: 60 })).toEqual({
      baseline: 1,
      height: 120,
      width: 24,
      x: 40,
      y: 60,
    });
  });

  it("draws a bar below the zero line downward from it, growing from its top", () => {
    // Recharts hands a value under zero as its own end, y = 230, and a height
    // back up to the zero line at y = 180.
    expect(barRectangle({ height: -50, width: 24, x: 40, y: 230 })).toEqual({
      baseline: 0,
      height: 50,
      width: 24,
      x: 40,
      y: 180,
    });
  });

  it("keeps a bar at zero flat on the zero line", () => {
    expect(barRectangle({ height: 0, width: 24, x: 40, y: 180 })).toEqual({
      baseline: 1,
      height: 0,
      width: 24,
      x: 40,
      y: 180,
    });
  });
});
