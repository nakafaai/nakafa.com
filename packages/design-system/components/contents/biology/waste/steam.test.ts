// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  ATMOSPHERE,
  celsiusAt,
  DIAL,
  gaugePressure,
  isVenting,
  needleAngle,
  ROOM,
  STERILISE,
  saturationPressure,
} from "@repo/design-system/components/contents/biology/waste/steam";

describe("steam in an autoclave", () => {
  it("matches the IAPWS-IF97 check values of the saturation pressure", () => {
    expect(saturationPressure(300)).toBeCloseTo(3.536_589_41, 6);
    expect(saturationPressure(500)).toBeCloseTo(2638.897_76, 3);
    expect(saturationPressure(600)).toBeCloseTo(12_344.3146, 2);
  });

  it("boils water at one atmosphere at 100 °C", () => {
    expect(saturationPressure(373.1243)).toBeCloseTo(ATMOSPHERE, 3);
  });

  it("reads about 104 kPa above the atmosphere at 121 °C, the autoclave's 15 psi", () => {
    expect(gaugePressure(STERILISE.celsius)).toBeCloseTo(103.71, 2);
    expect(gaugePressure(STERILISE.celsius) / 6.894_757).toBeCloseTo(15, 0);
  });

  it("reads zero on the gauge below boiling", () => {
    expect(gaugePressure(ROOM)).toBe(0);
  });

  it("turns the needle in proportion to the pressure, up to full scale", () => {
    expect(needleAngle(0)).toBe(0);
    expect(needleAngle(DIAL.full / 2)).toBeCloseTo(DIAL.sweep / 2, 12);
    expect(needleAngle(DIAL.full * 3)).toBe(DIAL.sweep);
  });

  it("heats to boiling, vents the air, then climbs to the sterilising hold", () => {
    expect(celsiusAt(-1)).toBe(ROOM);
    expect(celsiusAt(0)).toBe(ROOM);
    expect(celsiusAt(0.15)).toBeCloseTo((ROOM + 100) / 2, 12);
    expect(celsiusAt(0.4)).toBe(100);
    expect(celsiusAt(0.75)).toBeCloseTo(100 + 21 * 0.75, 12);
    expect(celsiusAt(1)).toBe(STERILISE.celsius);
    expect(celsiusAt(2)).toBe(STERILISE.celsius);
  });

  it("streams steam from the vent only while the air is driven out", () => {
    expect(isVenting(0.2)).toBe(false);
    expect(isVenting(0.4)).toBe(true);
    expect(isVenting(0.6)).toBe(false);
  });
});
