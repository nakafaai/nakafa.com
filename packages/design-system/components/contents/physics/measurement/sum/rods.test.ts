import { describe, expect, it } from "@effect/vitest";
import {
  COPPER_LENGTH,
  CopperToolSchema,
  IRON_LENGTH,
  joinedRods,
} from "@repo/design-system/components/contents/physics/measurement/sum/rods";

describe("two rods joined end to end", () => {
  it("rounds 8.235 cm plus a ruler's 4.5 cm to one decimal, 12.7 cm", () => {
    const rods = joinedRods("ruler");
    expect(rods.iron).toBeCloseTo(8.235, 12);
    expect(rods.copper).toBeCloseTo(4.5, 12);
    expect(rods.ironDecimals).toBe(3);
    expect(rods.copperDecimals).toBe(1);
    expect(rods.raw).toBeCloseTo(12.735, 12);
    expect(rods.decimals).toBe(1);
    expect(rods.reported).toBeCloseTo(12.7, 12);
    expect(rods.spread).toBeCloseTo(0.0525, 12);
  });

  it("keeps three decimals when both rods are read with the caliper", () => {
    const rods = joinedRods("caliper");
    expect(rods.copper).toBeCloseTo(4.5, 12);
    expect(rods.copperDecimals).toBe(3);
    expect(rods.decimals).toBe(3);
    expect(rods.reported).toBeCloseTo(12.735, 12);
    expect(rods.spread).toBeCloseTo(0.005, 12);
  });

  it("puts the true joined end inside the band the readings allow", () => {
    for (const tool of CopperToolSchema.literals) {
      const rods = joinedRods(tool);
      expect(Math.abs(IRON_LENGTH + COPPER_LENGTH - rods.raw)).toBeLessThanOrEqual(rods.spread);
    }
  });
});
