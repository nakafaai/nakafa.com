import { describe, expect, it } from "@effect/vitest";
import { hairReading } from "@repo/design-system/components/contents/physics/measurement/microscope/reticle";

describe("a hair under an eyepiece scale", () => {
  it("spans 2.7 divisions at 4x, 68 µm to two significant figures", () => {
    const reading = hairReading("low");
    expect(reading.divisions).toBeCloseTo(2.7, 12);
    expect(reading.diameter).toBeCloseTo(67.5, 9);
    expect(reading.figures).toBe(2);
  });

  it("spans 6.8 divisions at 10x and 27.2 at 40x, 68.0 µm to three figures", () => {
    expect(hairReading("medium").divisions).toBeCloseTo(6.8, 12);
    expect(hairReading("medium").figures).toBe(2);
    const high = hairReading("high");
    expect(high.divisions).toBeCloseTo(27.2, 12);
    expect(high.diameter).toBeCloseTo(68, 9);
    expect(high.figures).toBe(3);
  });
});
