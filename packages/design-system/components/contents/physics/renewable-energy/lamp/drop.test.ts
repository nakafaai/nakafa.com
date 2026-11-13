import { describe, expect, it } from "@effect/vitest";
import {
  bagHeight,
  DROP_ENERGY,
  DROP_HEIGHT,
  descentSeconds,
  dropPower,
  releasedEnergy,
} from "@repo/design-system/components/contents/physics/renewable-energy/lamp/drop";

describe("gravity lamp", () => {
  it("releases m g h, 12 kg falling 1.8 m", () => {
    expect(DROP_ENERGY).toBeCloseTo(216, 9);
  });

  it("spreads the same energy thinner over a slower descent", () => {
    expect(descentSeconds("steady")).toBe(1200);
    expect(dropPower("fast")).toBeCloseTo(0.36, 9);
    expect(dropPower("steady")).toBeCloseTo(0.18, 9);
    expect(dropPower("slow")).toBeCloseTo(0.12, 9);
  });

  it("lowers the bag evenly and stops it at the floor", () => {
    expect(bagHeight("fast", -5)).toBe(DROP_HEIGHT);
    expect(bagHeight("fast", 150)).toBeCloseTo(1.35, 9);
    expect(bagHeight("fast", 600)).toBe(0);
  });

  it("releases energy in step with the height lost", () => {
    expect(releasedEnergy("steady", 600)).toBeCloseTo(108, 9);
    expect(releasedEnergy("steady", 5000)).toBeCloseTo(DROP_ENERGY, 9);
  });
});
