import {
  getBarSeriesCue,
  getLineSeriesCue,
  getPointSeriesCue,
} from "@repo/design-system/lib/chart-series-cue";
import { describe, expect, it } from "vitest";

describe("chart series cues", () => {
  it("assigns distinct line strokes and markers", () => {
    expect([0, 1, 2].map(getLineSeriesCue)).toEqual([
      {
        activeDot: "colored-border",
        dot: "default",
        kind: "line",
      },
      {
        activeDot: "square-border",
        dot: "square",
        kind: "line",
        strokeDasharray: "8 4",
      },
      {
        activeDot: "diamond-border",
        dot: "diamond",
        kind: "line",
        strokeDasharray: "2 3",
      },
    ]);
  });

  it("assigns distinct point shapes", () => {
    expect([0, 1, 2].map(getPointSeriesCue)).toEqual([
      { activeDot: "colored-border", dot: "default", kind: "point" },
      { activeDot: "square-border", dot: "square", kind: "point" },
      { activeDot: "diamond-border", dot: "diamond", kind: "point" },
    ]);
  });

  it("assigns solid, hatched, and rounded bar geometries", () => {
    expect([0, 1, 2].map(getBarSeriesCue)).toEqual([
      { kind: "bar", radius: 0, variant: "default" },
      { kind: "bar", radius: 4, variant: "hatched" },
      { kind: "bar", radius: 12, variant: "default" },
    ]);
  });

  it("cycles cues safely for dynamic series", () => {
    expect(getLineSeriesCue(4)).toEqual(getLineSeriesCue(0));
    expect(getPointSeriesCue(-1)).toEqual(getPointSeriesCue(1));
    expect(getBarSeriesCue(Number.NaN)).toEqual(getBarSeriesCue(0));
    expect(getBarSeriesCue(4)).toEqual(getBarSeriesCue(0));
  });
});
