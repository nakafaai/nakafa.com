// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { BLOCK } from "@repo/design-system/components/contents/biology/capillary/bed";
import {
  apart,
  tissueCells,
  vesselDiscs,
} from "@repo/design-system/components/contents/biology/capillary/cells";
import { Array as Arr } from "effect";

describe("the tissue cells", () => {
  const cells = tissueCells();
  const vessels = vesselDiscs();

  it("fill the gaps between the vessels without touching them or each other", () => {
    expect(cells.length).toBeGreaterThan(15);
    Arr.forEach(cells, (cell, index) => {
      expect(Arr.every(vessels, (disc) => apart(cell, disc, 0.1))).toBe(true);
      Arr.forEach(Arr.drop(cells, index + 1), (other) => {
        expect(apart(cell, other, 0.1)).toBe(true);
      });
      expect(cell.x - cell.radius).toBeGreaterThan(BLOCK.left);
      expect(cell.x + cell.radius).toBeLessThan(BLOCK.right);
      expect(cell.z - cell.radius).toBeGreaterThan(BLOCK.back);
      expect(cell.z + cell.radius).toBeLessThan(BLOCK.front);
    });
  });

  it("measure 12 to 16 micrometres across", () => {
    Arr.forEach(cells, (cell) => {
      expect(cell.radius).toBeGreaterThanOrEqual(0.6);
      expect(cell.radius).toBeLessThanOrEqual(0.8);
    });
  });

  it("tells two discs apart only when the gap between their rims is wide enough", () => {
    const disc = { radius: 1, x: 0, z: 0 };
    expect(apart(disc, { radius: 1, x: 2.5, z: 0 }, 0.5)).toBe(true);
    expect(apart(disc, { radius: 1, x: 2.4, z: 0 }, 0.5)).toBe(false);
  });
});
