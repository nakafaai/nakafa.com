import { describe, expect, it } from "@effect/vitest";
import {
  SCREW_PITCH,
  SCREW_RESOLUTION,
  THIMBLE_DIVISIONS,
  micrometerReading,
  thimbleTurn,
} from "@repo/design-system/components/contents/physics/measurement/micrometer/screw";

describe("micrometer screw gauge", () => {
  it("resolves a hundredth of a millimetre from a half-millimetre pitch and 50 divisions", () => {
    expect(SCREW_PITCH / THIMBLE_DIVISIONS).toBeCloseTo(0.01, 12);
    expect(SCREW_RESOLUTION).toBeCloseTo(0.01, 12);
  });

  it("reads a quarter-inch ball as 6.0 mm on the sleeve and 35 on the thimble", () => {
    const { division, reading, sleeve } = micrometerReading(6.35);
    expect(sleeve).toBe(6);
    expect(division).toBe(35);
    expect(reading).toBeCloseTo(6.35, 9);
  });

  it("counts the half-millimetre line below the datum when the thimble passes it", () => {
    const { division, reading, sleeve } = micrometerReading(5.78);
    expect(sleeve).toBe(5.5);
    expect(division).toBe(28);
    expect(reading).toBeCloseTo(5.78, 9);
  });

  it("turns the thimble once for every half millimetre of travel", () => {
    expect(thimbleTurn(0)).toBe(0);
    expect(thimbleTurn(0.5)).toBeCloseTo(0, 9);
    expect(thimbleTurn(6.35)).toBeCloseTo(35, 9);
    expect(thimbleTurn(0.255)).toBeCloseTo(25.5, 9);
  });
});
