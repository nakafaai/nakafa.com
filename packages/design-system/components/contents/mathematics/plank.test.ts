// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BOARDS,
  plankShades,
} from "@repo/design-system/components/contents/mathematics/plank";
import { Array as Arr } from "effect";

describe("a planked tabletop", () => {
  it("shades every texel between a seam's dark and the palest early wood, the same on every call", () => {
    const field = plankShades(64, 64);
    expect(field).toHaveLength(64 * 64);
    expect(Math.min(...field)).toBeGreaterThan(0.3);
    expect(Math.max(...field)).toBeLessThanOrEqual(1);
    expect(plankShades(64, 64)).toEqual(field);
  });

  it("darkens the seam where two boards meet", () => {
    const size = 128;
    const field = plankShades(size, size);
    const rowMean = (row: number) => {
      const start = row * size;
      return (
        field
          .slice(start, start + size)
          .reduce((sum, shade) => sum + shade, 0) / size
      );
    };
    const board = size / BOARDS;
    expect(rowMean(0)).toBeLessThan(rowMean(board / 2) * 0.7);
    expect(rowMean(board)).toBeLessThan(rowMean(board + board / 2) * 0.7);
  });

  it("gives neighbouring boards their own tone", () => {
    const size = 128;
    const field = plankShades(size, size);
    const board = size / BOARDS;
    const middles = Arr.map(Arr.range(0, BOARDS - 1), (index) => {
      const start = (index * board + board / 2) * size;
      return (
        Arr.reduce(
          Arr.fromIterable(field.subarray(start, start + size)),
          0,
          (sum, shade) => sum + shade
        ) / size
      );
    });
    expect(
      Arr.dedupe(Arr.map(middles, (tone) => tone.toFixed(3))).length
    ).toBeGreaterThan(1);
  });
});
