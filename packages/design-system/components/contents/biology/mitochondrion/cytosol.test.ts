// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Point } from "@repo/design-system/components/contents/biology/mitochondrion/anatomy";
import {
  bandAt,
  CYTOSOL,
  CYTOSOL_RIBOSOMES,
  ENVELOPE,
  GLYCOGEN,
  insideCell,
  keptIn,
  MYOFIBRIL,
  outsideBody,
  POLYSOME,
} from "@repo/design-system/components/contents/biology/mitochondrion/cytosol";
import { GLYCOLYSIS } from "@repo/design-system/components/contents/biology/mitochondrion/respiration";
import { compartmentOf } from "@repo/design-system/components/contents/biology/mitochondrion/test/compartment";

describe("the cytosol around the organelle", () => {
  it("strings its ribosomes as polysomes, all outside the organelle", () => {
    expect(CYTOSOL_RIBOSOMES.length % POLYSOME).toBe(0);
    expect(CYTOSOL_RIBOSOMES.length).toBeGreaterThan(100);
    for (const ribosome of CYTOSOL_RIBOSOMES) {
      expect(compartmentOf(ribosome)).toBe("cytoplasm");
    }
  });

  it("scatters glycogen through the cytosol, clear of the organelle", () => {
    expect(GLYCOGEN.length).toBeGreaterThan(40);
    for (const granule of GLYCOGEN) {
      expect(outsideBody(granule, 0.06)).toBe(true);
      expect(granule[2]).toBeLessThanOrEqual(CYTOSOL.z[1]);
    }
    expect(outsideBody([0, 0, -0.2], 0)).toBe(false);
    expect(outsideBody([1.3, 0, 0], 0.1)).toBe(true);
  });

  it("bands a myofibril by its 2.2 µm sarcomeres: Z disc, I band, A band, H zone, M line", () => {
    const z = MYOFIBRIL.offset;
    const middle = z + MYOFIBRIL.sarcomere / 2;
    expect(bandAt(z)).toBe("z");
    expect(bandAt(z + MYOFIBRIL.sarcomere)).toBe("z");
    expect(bandAt(z + 0.2)).toBe("i");
    expect(bandAt(middle - 0.6)).toBe("a");
    expect(bandAt(middle - 0.1)).toBe("h");
    expect(bandAt(middle)).toBe("m");
    expect(bandAt(z - 0.2)).toBe("i");
    expect(MYOFIBRIL.sarcomere - MYOFIBRIL.bandA).toBeCloseTo(0.6, 12);
  });

  it("keeps a yeast cell's contents inside its envelope, glucose coming in from outside", () => {
    const thickness = ENVELOPE.membrane + ENVELOPE.glucan + ENVELOPE.mannan;
    expect(thickness - ENVELOPE.membrane).toBeGreaterThanOrEqual(0.1);
    expect(thickness - ENVELOPE.membrane).toBeLessThanOrEqual(0.2);
    expect(insideCell(GLYCOLYSIS, 0.2)).toBe(true);
    const outside: Point = [-1.7, 1.6, 0];
    expect(insideCell(outside, 0)).toBe(false);
    expect(keptIn("yeast", outside, 0)).toBe(false);
    expect(keptIn("muscle", outside, 0)).toBe(true);
  });
});
