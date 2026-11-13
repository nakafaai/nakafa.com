// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  discTemperature,
  kineticEnergy,
  START_TEMPERATURE,
  temperatureRise,
  thermalColor,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/heat";

describe("brake heat", () => {
  it("stores ½mv² in the moving car", () => {
    expect(kineticEnergy(20)).toBe(240_000);
  });

  it("warms the discs four times as much when the speed doubles", () => {
    expect(temperatureRise(20)).toBeCloseTo(240_000 / (4 * 8 * 449), 12);
    expect(temperatureRise(20) / temperatureRise(10)).toBeCloseTo(4, 12);
  });

  it("releases most of the heat early in the stop, when the car is fast", () => {
    expect(discTemperature(20, 0)).toBe(START_TEMPERATURE);
    expect(discTemperature(20, 0.5)).toBeCloseTo(
      START_TEMPERATURE + temperatureRise(20) * 0.75,
      12
    );
    expect(discTemperature(20, 2)).toBeCloseTo(
      START_TEMPERATURE + temperatureRise(20),
      12
    );
    expect(discTemperature(20, -1)).toBe(START_TEMPERATURE);
  });

  it("paints a thermal palette from cold blue to pale yellow", () => {
    expect(thermalColor(10)).toEqual([0.04, 0.02, 0.18]);
    expect(thermalColor(90)).toEqual([1, 0.98, 0.82]);
    const halfway = thermalColor(43);
    expect(halfway[0]).toBeCloseTo((0.36 + 0.78) / 2, 12);
    const red = thermalColor(48);
    expect(red[0]).toBeCloseTo(0.78, 12);
    expect(red[2]).toBeCloseTo(0.26, 12);
  });
});
