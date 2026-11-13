// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BUD_MINUTES,
  bodyOf,
  budShare,
  isDividing,
  lengthOf,
  SIZES,
  scaleBar,
  timesLarger,
  viewWidth,
} from "@repo/design-system/components/contents/biology/cell/anatomy";

describe("cell bodies", () => {
  it("keeps each kingdom's cell at its real relative size", () => {
    expect(lengthOf("plant")).toBeGreaterThan(lengthOf("animal"));
    expect(lengthOf("animal")).toBeGreaterThan(lengthOf("yeast"));
    expect(lengthOf("yeast")).toBeGreaterThan(lengthOf("bacterium"));
    expect(bodyOf("bacterium").outline).toBe("rod");
    expect(bodyOf("bacterium").height).toBe(1);
  });

  it("draws a scale bar of 1, 2 or 5 times a power of ten within half the cell", () => {
    expect(scaleBar(20)).toBe(10);
    expect(scaleBar(40)).toBe(20);
    expect(scaleBar(5)).toBe(2);
    expect(scaleBar(2)).toBe(1);
    expect(scaleBar(1.4)).toBe(0.5);
  });
});

describe("budding yeast", () => {
  it("shows no bud early, then grows it to four fifths of the mother", () => {
    expect(budShare(0)).toBe(0);
    expect(budShare(BUD_MINUTES * 0.1)).toBe(0);
    expect(budShare(BUD_MINUTES * 0.6)).toBeCloseTo(0.8 * Math.sqrt(0.5));
    expect(budShare(BUD_MINUTES - 1e-9)).toBeCloseTo(0.8);
  });

  it("wraps time outside one cycle into it", () => {
    expect(budShare(BUD_MINUTES + 54)).toBeCloseTo(budShare(54));
    expect(budShare(-36)).toBeCloseTo(budShare(54));
  });

  it("moves the nucleus into the neck only late in the cycle", () => {
    expect(isDividing(30)).toBe(false);
    expect(isDividing(88)).toBe(true);
  });
});

describe("zooming from a cell to a virus", () => {
  it("compares the real sizes", () => {
    expect(timesLarger(SIZES.cell, SIZES.virion)).toBeCloseTo(200);
    expect(timesLarger(SIZES.bacterium, SIZES.virion)).toBeCloseTo(20);
  });

  it("narrows the view by the same factor at every step", () => {
    expect(viewWidth(0)).toBe(50);
    expect(viewWidth(1)).toBeCloseTo(0.25);
    expect(viewWidth(0.5) / viewWidth(0)).toBeCloseTo(
      viewWidth(1) / viewWidth(0.5)
    );
    expect(viewWidth(-1)).toBe(50);
    expect(viewWidth(2)).toBeCloseTo(0.25);
  });
});
