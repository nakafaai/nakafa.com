import { describe, expect, it } from "@effect/vitest";
import {
  HOMES,
  homesLit,
  plantPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/microhydro/stream";

describe("microhydro plant", () => {
  it("delivers ρ g Q h η, 1400 W from 20 L/s through 10 m", () => {
    expect(plantPower(20, 10)).toBeCloseTo(1400, 9);
  });

  it("doubles its power with twice the flow or twice the head", () => {
    expect(plantPower(20, 20)).toBeCloseTo(2 * plantPower(20, 10), 9);
    expect(plantPower(10, 10) * 2).toBeCloseTo(plantPower(20, 10), 9);
  });

  it("lights one home for every full 250 W", () => {
    expect(homesLit(20, 10)).toBe(5);
    expect(homesLit(5, 5)).toBe(0);
  });

  it("never lights more homes than the hamlet has", () => {
    expect(homesLit(30, 20)).toBe(HOMES);
  });
});
