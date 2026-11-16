import { describe, expect, it } from "@effect/vitest";
import {
  CYLINDER_AREA,
  levelOf,
  parallaxReading,
  TRUE_VOLUME,
} from "@repo/design-system/components/contents/physics/measurement/parallax/meniscus";

describe("parallax on a measuring cylinder", () => {
  it("fills 7.07 square centimetres of cross-section per centimetre of height", () => {
    expect(CYLINDER_AREA).toBeCloseTo(7.0686, 4);
    expect(levelOf(TRUE_VOLUME)).toBeCloseTo(5.942, 3);
  });

  it("reads the true volume with the eye level with the meniscus", () => {
    const reading = parallaxReading(0);
    expect(reading.reading).toBeCloseTo(TRUE_VOLUME, 9);
    expect(reading.error).toBeCloseTo(0, 9);
  });

  it("reads 2.1 mL too high from 6 cm above and as much too low from below", () => {
    expect(parallaxReading(6).reading).toBeCloseTo(44.12, 2);
    expect(parallaxReading(6).error).toBeCloseTo(2.12, 2);
    expect(parallaxReading(-6).error).toBeCloseTo(-2.12, 2);
  });

  it("sees the meniscus through a point on the wall a twentieth of the eye's height away", () => {
    const { level, seen } = parallaxReading(4);
    expect(seen - level).toBeCloseTo(0.2, 9);
  });
});
