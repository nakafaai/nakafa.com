// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Strip } from "@repo/design-system/components/contents/biology/osmosis/tissue";
import {
  changeAt,
  isotonicPoint,
  lengthAfter,
  massAfter,
  protoplastFill,
  tonicity,
} from "@repo/design-system/components/contents/biology/osmosis/tissue";
import { Option } from "effect";

const SERIES: readonly [Strip, ...Strip[]] = [
  { change: -10, concentration: 0.6 },
  { change: 12, concentration: 0 },
  { change: -2, concentration: 0.4 },
  { change: 6, concentration: 0.2 },
];

describe("osmosis in potato strips", () => {
  it("finds where the mass change crosses zero", () => {
    expect(Option.getOrThrow(isotonicPoint(SERIES))).toBeCloseTo(0.35, 12);
  });

  it("finds no crossing when every strip gains", () => {
    expect(
      Option.isNone(
        isotonicPoint([
          { change: 8, concentration: 0 },
          { change: 3, concentration: 0.2 },
        ])
      )
    ).toBe(true);
  });

  it("reads a tube whose strip did not change as the point itself", () => {
    expect(
      isotonicPoint([
        { change: 0, concentration: 0.3 },
        { change: 0, concentration: 0.5 },
      ])
    ).toEqual(Option.some(0.3));
  });

  it("reads the change between two tubes as linear, and holds it beyond the series", () => {
    const series = [SERIES[0], SERIES[1], SERIES[2], SERIES[3]] as const;

    expect(changeAt(series, 0.5)).toBeCloseTo(-6, 12);
    expect(changeAt(series, 0.1)).toBeCloseTo(9, 12);
    expect(changeAt(series, -1)).toBe(12);
    expect(changeAt(series, 2)).toBe(-10);
  });

  it("presses the protoplast on the wall when it gains and pulls it away when it loses", () => {
    expect(protoplastFill(6)).toBe(1);
    expect(protoplastFill(-10)).toBeCloseTo(0.6, 12);
    expect(protoplastFill(-40)).toBe(0.45);
  });

  it("scales the mass and length of a strip by its change", () => {
    expect(massAfter(5, -10)).toBe(4.5);
    expect(lengthAfter(50, 6)).toBe(53);
  });

  it("names the solution against the cell sap", () => {
    expect(tonicity(6)).toBe("hypotonic");
    expect(tonicity(0)).toBe("isotonic");
    expect(tonicity(-2)).toBe("hypertonic");
  });
});
