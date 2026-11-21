// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  arcs,
  CELL,
  cellUnit,
  columnWidth,
  cutNuclei,
  NUCLEUS,
  nucleusAt,
  pcg,
} from "@repo/design-system/components/contents/biology/muscle/nuclei";
import { Array as Arr } from "effect";

describe("myonuclei", () => {
  it("hashes in 32-bit unsigned arithmetic, as the shader does", () => {
    expect(pcg(0)).toBe(pcg(0));
    expect(pcg(0)).not.toBe(pcg(1));
    expect(Number.isInteger(pcg(12_345))).toBe(true);
    expect(pcg(12_345)).toBeGreaterThanOrEqual(0);
    expect(pcg(12_345)).toBeLessThan(2 ** 32);
    expect(cellUnit(3, 4, 5, 1)).toBeGreaterThanOrEqual(0);
    expect(cellUnit(3, 4, 5, 1)).toBeLessThan(1);
    expect(cellUnit(3, 4, 5, 1)).not.toBe(cellUnit(3, 4, 5, 2));
  });

  it("closes each fibre's ring with whole columns of cells", () => {
    const { perimeter, starts } = arcs(0);
    expect(starts).toHaveLength(96);
    expect(starts[0]).toBe(0);
    expect(perimeter).toBeGreaterThan(20);
    expect(perimeter).toBeLessThan(28);
    const width = columnWidth(perimeter);
    expect(perimeter / width).toBeCloseTo(
      Math.round(perimeter / CELL.around),
      9
    );
    expect(columnWidth(1)).toBe(1);
  });

  it("keeps every nucleus inside its own cell", () => {
    const width = columnWidth(arcs(1).perimeter);
    for (const row of Arr.range(0, 11)) {
      for (const column of Arr.range(0, 4)) {
        const { along, arc } = nucleusAt(1, row, column, width, -20);
        expect(along - NUCLEUS.length / 2).toBeGreaterThan(
          -20 + row * CELL.along
        );
        expect(along + NUCLEUS.length / 2).toBeLessThan(
          -20 + (row + 1) * CELL.along
        );
        expect(arc - NUCLEUS.width / 2).toBeGreaterThan(column * width);
        expect(arc + NUCLEUS.width / 2).toBeLessThan((column + 1) * width);
      }
    }
  });

  it("finds about two nuclei in a fibre's cross-section, as real sections show", () => {
    const counts = Arr.map(
      Arr.range(0, 6),
      (fibre) =>
        Arr.reduce(
          Arr.range(0, 39),
          0,
          (sum, step) => sum + cutNuclei(fibre, -18 + step * 0.9, -20).length
        ) / 40
    );
    const mean =
      Arr.reduce(counts, 0, (sum, count) => sum + count) / counts.length;
    expect(mean).toBeGreaterThan(1.5);
    expect(mean).toBeLessThan(3);
    for (const section of cutNuclei(2, 15, -20)) {
      expect(section.share).toBeGreaterThan(0);
      expect(section.share).toBeLessThanOrEqual(1);
      expect(section.angle).toBeGreaterThanOrEqual(0);
      expect(section.angle).toBeLessThan(Math.PI * 2);
    }
  });
});
