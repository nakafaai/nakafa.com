import { describe, expect, it } from "@effect/vitest";
import {
  VERNIER_DIVISIONS,
  VERNIER_RESOLUTION,
  VERNIER_STEP,
  vernierMark,
  vernierMiss,
  vernierReading,
} from "@repo/design-system/components/contents/physics/measurement/vernier/caliper";
import { Array as Arr } from "effect";

describe("vernier caliper", () => {
  it("resolves a tenth of a millimetre from ten divisions over nine millimetres", () => {
    expect(VERNIER_DIVISIONS * VERNIER_STEP).toBeCloseTo(9, 12);
    expect(VERNIER_RESOLUTION).toBeCloseTo(0.1, 12);
  });

  it("reads 23.7 mm as 23 whole millimetres and the seventh vernier line", () => {
    const { line, main, reading } = vernierReading(23.7);
    expect(main).toBe(23);
    expect(line).toBe(7);
    expect(reading).toBeCloseTo(23.7, 9);
  });

  it("reads a whole millimetre with the vernier zero on a main mark", () => {
    expect(vernierReading(30)).toEqual({ line: 0, main: 30, reading: 30 });
  });

  it("puts the named line exactly on a main mark and every other line off one", () => {
    const zero = 23.7;
    const { line } = vernierReading(zero);
    expect(vernierMark(zero, line)).toBeCloseTo(30, 9);
    expect(vernierMiss(zero, line)).toBeCloseTo(0, 9);
    const others = Arr.filter(
      Arr.range(0, VERNIER_DIVISIONS),
      (index) => index !== line
    );
    for (const index of others) {
      expect(vernierMiss(zero, index)).toBeGreaterThan(0.05);
    }
  });
});
