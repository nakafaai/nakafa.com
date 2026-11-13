// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BUDGET,
  cutOf,
  fossilIn,
  pathwayOf,
  RECORD_SPAN,
  recordLevel,
  recordRate,
  sinkAt,
} from "@repo/design-system/components/contents/biology/climate/budget";
import { Array as Arr, Option } from "effect";

describe("the Mauna Loa record", () => {
  it("reads each year and the years between", () => {
    expect(recordLevel(1960)).toBe(316.91);
    expect(recordLevel(RECORD_SPAN.last)).toBe(424.61);
    expect(recordLevel(1965)).toBeCloseTo((316.91 + 325.68) / 2);
    expect(recordLevel(1900)).toBe(316.91);
    expect(recordLevel(2100)).toBe(424.61);
  });

  it("reads how fast the level rose over the last ten years", () => {
    expect(recordRate(1970)).toBeCloseTo((325.68 - 316.91) / 10);
    expect(recordRate(1960)).toBeCloseTo(recordRate(1970));
    expect(recordRate(2020)).toBeCloseTo((414.21 - 390.1) / 10);
  });
});

describe("the budget", () => {
  it("grows the air by about 2.4 ppm a year today", () => {
    expect(sinkAt(BUDGET.start)).toBeCloseTo(6.1);
    const [, next] = pathwayOf({ cut: 0, forest: 0 }, 2025);
    expect(next && next.level - BUDGET.start).toBeCloseTo(5.2 / 2.124, 1);
  });

  it("adds the regions that join, each once", () => {
    expect(cutOf(["china", "usa"])).toBeCloseTo(0.44);
    expect(cutOf(["china", "china"])).toBeCloseTo(0.31);
    expect(cutOf(["china", "usa", "india", "europe", "rest"])).toBeCloseTo(1);
  });

  it("cuts fossil CO2 in a straight line to 2050 and holds it there", () => {
    const half = { cut: 1, forest: 0 };
    expect(fossilIn(2024, half)).toBe(BUDGET.fossil);
    expect(fossilIn(2037, half)).toBeCloseTo(BUDGET.fossil / 2);
    expect(fossilIn(2080, half)).toBe(0);
    expect(fossilIn(2080, { cut: 3, forest: 0 })).toBe(0);
  });

  it("keeps rising without cuts and turns down with them", () => {
    const current = Option.getOrThrow(Arr.last(pathwayOf({ cut: 0, forest: 0 }, 2100)));
    const zero = Option.getOrThrow(Arr.last(pathwayOf({ cut: 1, forest: 1 }, 2100)));
    expect(current.year).toBe(2100);
    expect(current.level).toBeGreaterThan(510);
    expect(current.net).toBeGreaterThan(0);
    expect(current.warming).toBeGreaterThan(2.5);
    expect(zero.level).toBeLessThan(BUDGET.start);
    expect(zero.warming).toBeLessThan(1.7);
    expect(pathwayOf({ cut: 0, forest: -2 }, 2000)).toHaveLength(2);
  });
});
