// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  micrometerLines,
  phaseOf,
  slideCells,
} from "@repo/design-system/components/contents/biology/microscope/slide";
import { Array as Arr } from "effect";

describe("slide specimens", () => {
  it("shares root-tip cells among the stages of the cell cycle", () => {
    expect(phaseOf(0.1)).toBe("interphase");
    expect(phaseOf(0.8)).toBe("prophase");
    expect(phaseOf(0.87)).toBe("metaphase");
    expect(phaseOf(0.92)).toBe("anaphase");
    expect(phaseOf(0.99)).toBe("telophase");
  });

  it("fills the field with cells of the given size and no farther", () => {
    const reach = 60;

    for (const specimen of ["cheek", "onion", "root"] as const) {
      const cells = slideCells(specimen, 10, reach);
      expect(cells.length).toBeGreaterThan(10);
      expect(
        Arr.every(cells, (cell) => Math.hypot(...cell.nucleus) < reach + 16)
      ).toBe(true);
    }
  });

  it("draws onion cells three times as long as wide and root cells square", () => {
    const [onion] = slideCells("onion", 30, 5);
    const [root] = slideCells("root", 8, 5);

    expect(onion?.outline[1]?.[0]).toBeCloseTo(
      (onion?.outline[0]?.[0] ?? 0) + 30,
      12
    );
    expect(onion?.outline[2]?.[1]).toBeCloseTo(
      (onion?.outline[1]?.[1] ?? 0) + 10,
      12
    );
    // A root cell's corners are nudged by up to a ninth of its side.
    const side = (root?.outline[2]?.[1] ?? 0) - (root?.outline[1]?.[1] ?? 0);
    expect(Math.abs(side - 8)).toBeLessThanOrEqual(8 * 0.22);
  });

  it("engraves the micrometer longer every fifth and tenth line", () => {
    const lines = micrometerLines(2, 20);

    expect(lines).toHaveLength(21);
    expect(lines[10]).toEqual({ length: 1, x: 0 });
    expect(lines[15]?.length).toBe(0.7);
    expect(lines[11]?.length).toBe(0.45);
  });
});
