import { describe, expect, it } from "@effect/vitest";
import {
  BATTERY_ENERGY,
  heatPower,
  lightEnergy,
  lightPower,
  RUN_TIME,
} from "@repo/design-system/components/contents/physics/renewable-energy/flashlight/bulb";

describe("flashlight", () => {
  it("stores 3 V × 2.5 Ah, 27 000 J, in its two cells", () => {
    expect(BATTERY_ENERGY).toBe(27_000);
  });

  it("runs 7.5 h at 1 W whatever the bulb", () => {
    expect(RUN_TIME / 3600).toBe(7.5);
  });

  it("splits the same 1 W into light and heat", () => {
    expect(lightPower("filament")).toBeCloseTo(0.05, 9);
    expect(heatPower("filament")).toBeCloseTo(0.95, 9);
    expect(lightPower("led")).toBeCloseTo(0.4, 9);
    expect(heatPower("led")).toBeCloseTo(0.6, 9);
  });

  it("gives eight times the light from the same battery with an LED", () => {
    expect(lightEnergy("filament")).toBeCloseTo(1350, 9);
    expect(lightEnergy("led")).toBeCloseTo(10_800, 9);
    expect(lightEnergy("led") / lightEnergy("filament")).toBeCloseTo(8, 9);
  });
});
