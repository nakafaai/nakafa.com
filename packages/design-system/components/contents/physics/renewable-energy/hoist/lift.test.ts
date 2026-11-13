import { describe, expect, it } from "@effect/vitest";
import {
  CRATE_WEIGHT,
  crateHeight,
  LIFT_ENERGY,
  LIFT_HEIGHT,
  liftSpeed,
  liftTime,
  MOTOR_POWER,
  workDone,
} from "@repo/design-system/components/contents/physics/renewable-energy/hoist/lift";

describe("motor hoist", () => {
  it("gives the crate its weight times the height, 200 N over 5 m", () => {
    expect(CRATE_WEIGHT).toBe(200);
    expect(LIFT_ENERGY).toBe(1000);
  });

  it("lifts the same 1000 J sooner with a stronger motor", () => {
    expect(liftTime("small")).toBe(10);
    expect(liftTime("medium")).toBe(4);
    expect(liftTime("large")).toBe(2);
    expect(MOTOR_POWER.large * liftTime("large")).toBe(LIFT_ENERGY);
  });

  it("raises the crate at power over force", () => {
    expect(liftSpeed("small")).toBe(0.5);
    expect(liftSpeed("large")).toBe(2.5);
  });

  it("follows the crate up and holds it at the platform", () => {
    expect(crateHeight("medium", -1)).toBe(0);
    expect(crateHeight("medium", 2)).toBe(2.5);
    expect(crateHeight("medium", 9)).toBe(LIFT_HEIGHT);
  });

  it("counts the work done so far, reaching the full energy at the top", () => {
    expect(workDone("small", 4)).toBe(400);
    expect(workDone("small", 12)).toBe(LIFT_ENERGY);
  });
});
