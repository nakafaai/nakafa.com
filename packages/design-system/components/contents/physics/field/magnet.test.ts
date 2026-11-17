import { describe, expect, it } from "@effect/vitest";
import {
  balancingCurrent,
  fallThrough,
  fallTime,
  transformer,
} from "@repo/design-system/components/contents/physics/field/magnet";

describe("transformer", () => {
  it("steps 240 V down to 12 V with 20 turns to 1 and draws 0.125 A at 80% efficiency", () => {
    const coils = transformer({
      efficiency: 0.8,
      output: 24,
      primary: 240,
      secondary: 12,
    });
    expect(coils.ratio).toBe(20);
    expect(coils.input).toBeCloseTo(30, 9);
    expect(coils.lost).toBeCloseTo(6, 9);
    expect(coils.primaryCurrent).toBeCloseTo(0.125, 9);
    expect(coils.secondaryCurrent).toBe(2);
  });
});

describe("balancingCurrent", () => {
  it("holds a 6.0 g wire 20 cm long up in 0.15 T with 2.0 A flowing east when the field points north", () => {
    const balance = balancingCurrent(
      { field: 0.15, length: 0.2, mass: 0.006 },
      10,
      [0, 1, 0]
    );
    expect(balance.current).toBeCloseTo(2, 9);
    expect(balance.direction).toEqual([1, 0, 0]);
  });
});

describe("fallThrough", () => {
  it("falls freely without drag", () => {
    expect(fallThrough(0, 10, 2)).toEqual({ distance: 20, speed: 20 });
  });

  it("approaches the terminal speed g / k with drag", () => {
    const braked = fallThrough(50, 10, 1);
    expect(braked.speed).toBeCloseTo(0.2, 6);
    expect(braked.distance).toBeCloseTo(0.196, 3);
  });

  it("takes longer to fall a metre with drag than freely", () => {
    expect(fallTime(0, 10, 1)).toBeCloseTo(Math.sqrt(0.2), 6);
    expect(fallTime(50, 10, 1)).toBeCloseTo(5.02, 2);
  });
});
