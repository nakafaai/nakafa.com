import { describe, expect, it } from "@effect/vitest";
import {
  dailyEnergy,
  rotorSpeed,
  turbinePower,
  windPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";

describe("wind turbine at three sites", () => {
  it("carries ½ ρ A v³ through a 40 m rotor", () => {
    expect(windPower("valley")).toBeCloseTo(197_041, 0);
    expect(windPower("coast")).toBeCloseTo(1_576_325.5, 0);
  });

  it("gives eight times the power for twice the wind speed", () => {
    expect(turbinePower("coast") / turbinePower("valley")).toBeCloseTo(8, 9);
  });

  it("makes about 79 kW, 266 kW and 631 kW of electricity", () => {
    expect(turbinePower("valley") / 1000).toBeCloseTo(78.8, 1);
    expect(turbinePower("hill") / 1000).toBeCloseTo(266.0, 1);
    expect(turbinePower("coast") / 1000).toBeCloseTo(630.5, 1);
  });

  it("adds up a day of steady wind and turns the rotor at seven times the wind at the tips", () => {
    expect(dailyEnergy("hill")).toBeCloseTo(6384.1, 1);
    expect(rotorSpeed("coast")).toBeCloseTo(1.4, 9);
  });
});
