import { describe, expect, it } from "@effect/vitest";
import {
  inletSpeed,
  stagePowers,
  waterPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/dam/chain";

describe("hydropower dam", () => {
  it("releases ρ g Q h each second, in step with the head", () => {
    expect(waterPower(20)).toBe(2_000_000);
    expect(waterPower(100)).toBe(10_000_000);
  });

  it("brings the water to the turbine at √(2 g h)", () => {
    expect(inletSpeed(20)).toBe(20);
    expect(inletSpeed(80)).toBe(40);
  });

  it("keeps every joule of potential energy as kinetic energy in an ideal penstock", () => {
    const stages = stagePowers(50);
    expect(stages.kinetic).toBe(stages.potential);
  });

  it("passes 90% to the shaft and 95% of that to the grid, 85.5% in all", () => {
    const stages = stagePowers(50);
    expect(stages.shaft).toBeCloseTo(4_500_000, 6);
    expect(stages.electric).toBeCloseTo(4_275_000, 6);
    expect(stages.electric / stages.potential).toBeCloseTo(0.855, 9);
  });
});
