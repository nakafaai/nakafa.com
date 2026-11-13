import { describe, expect, it } from "@effect/vitest";
import {
  averageMass,
  getSample,
  pathRadius,
  SampleIdSchema,
} from "@repo/design-system/components/contents/chemistry/spectrometer/isotopes";
import { Array as Arr } from "effect";

describe("isotopes", () => {
  it("adds every sample's abundances up to one", () => {
    for (const id of SampleIdSchema.literals) {
      const total = Arr.reduce(
        getSample(id).isotopes,
        0,
        (sum, isotope) => sum + isotope.abundance
      );
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it("gives the standard atomic weights of the periodic table", () => {
    expect(averageMass("chlorine")).toBeCloseTo(35.45, 2);
    expect(averageMass("magnesium")).toBeCloseTo(24.305, 2);
    expect(averageMass("carbon")).toBeCloseTo(12.011, 3);
    expect(averageMass("boron")).toBeCloseTo(10.81, 2);
    expect(averageMass("neon")).toBeCloseTo(20.18, 2);
    expect(averageMass("copper")).toBeCloseTo(63.546, 2);
  });

  it("turns a heavier ion on a wider path, as the square root of its mass", () => {
    expect(pathRadius(37, 35)).toBeCloseTo(Math.sqrt(37 / 35), 12);
    expect(pathRadius(35, 35)).toBe(1);
  });
});
