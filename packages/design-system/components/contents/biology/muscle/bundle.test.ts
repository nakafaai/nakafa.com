// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  area,
  CAPILLARIES,
  CENTRES,
  CLEARANCE,
  gap,
  hull,
  LUMEN,
  MICRONS,
  outline,
  reach,
  SPACING,
  WALL,
} from "@repo/design-system/components/contents/biology/muscle/bundle";
import { Array as Arr } from "effect";

/** A fibre's cross-section in square micrometres. */
function fibreArea(index: number) {
  return area(outline(Arr.getUnsafe(CENTRES, index), 360)) * MICRONS ** 2;
}

describe("a fascicle in cross-section", () => {
  it("packs seven fibres of a human fibre's real size", () => {
    // Human vastus lateralis: 4267 to 4490 µm² for type I fibres, 4407 to 5895 µm² for type IIA.
    expect(CENTRES).toHaveLength(7);
    for (const index of Arr.range(0, 6)) {
      expect(fibreArea(index)).toBeGreaterThan(4000);
      expect(fibreArea(index)).toBeLessThan(5900);
    }
  });

  it("keeps the endomysium between neighbouring fibres", () => {
    const middle: readonly [number, number] = [SPACING / 2, 0];
    expect(gap(middle)).toBeGreaterThan(0.04);
    expect(gap(middle)).toBeLessThan(0.1);
    expect(gap([0, 0])).toBeLessThan(-3);
  });

  it("rounds a fibre's corners and flattens its sides against its neighbours", () => {
    const side = reach([0, 0], 0);
    const corner = reach([0, 0], Math.PI / 6);
    expect(side).toBeCloseTo(SPACING / 2 - 0.06, 1);
    expect(corner).toBeLessThan(SPACING / 2 / Math.cos(Math.PI / 6) - 0.3);
  });

  it("gives every capillary room without touching a fibre", () => {
    expect(CAPILLARIES).toHaveLength(12);
    for (const capillary of CAPILLARIES) {
      expect(gap(capillary)).toBeGreaterThanOrEqual(CLEARANCE - 1e-6);
      const ring = Arr.map(Arr.range(0, 35), (step) => {
        const angle = (step / 36) * Math.PI * 2;
        return gap([
          capillary[0] + Math.cos(angle) * (LUMEN + WALL),
          capillary[1] + Math.sin(angle) * (LUMEN + WALL),
        ]);
      });
      expect(Math.min(...ring)).toBeGreaterThan(0);
    }
  });

  it("wraps a hull round every fibre and capillary", () => {
    const angles = Arr.map(
      Arr.range(0, 71),
      (step) => (step / 72) * Math.PI * 2
    );
    for (const angle of angles) {
      const edge = hull(angle);
      expect(
        gap([Math.cos(angle) * edge, Math.sin(angle) * edge])
      ).toBeGreaterThanOrEqual(-1e-9);
    }
  });
});
