import { describe, expect, it } from "@effect/vitest";
import {
  electricPower,
  heatRate,
  idealEfficiency,
  plantEfficiency,
} from "@repo/design-system/components/contents/physics/renewable-energy/geothermal/loop";

describe("geothermal loop", () => {
  it("draws m c ΔT from water cooled to 70 °C", () => {
    expect(heatRate(200)).toBe(54_600_000);
    expect(heatRate(120)).toBe(21_000_000);
  });

  it("caps the engine at 1 - 300 K / T_h, higher for hotter water", () => {
    expect(idealEfficiency(200)).toBeCloseTo(0.3658, 4);
    expect(idealEfficiency(300)).toBeGreaterThan(idealEfficiency(200));
  });

  it("reaches 40% of the limit in a real plant", () => {
    expect(plantEfficiency(200)).toBeCloseTo(0.1463, 4);
  });

  it("makes about 8 MW from 200 °C water, and much more from hotter water", () => {
    expect(electricPower(200)).toBeCloseTo(7_988_000, -3);
    expect(electricPower(300) / electricPower(150)).toBeGreaterThan(4);
  });
});
