import { describe, expect, it } from "@effect/vitest";
import {
  BOBS,
  pendulumPeriod,
  periodPowers,
} from "@repo/design-system/components/contents/physics/measurement/pendulum/period";

describe("a pendulum's period by dimensional analysis", () => {
  it("finds mass to the power 0, length to 1/2 and gravity to -1/2", () => {
    const { gravity, length, mass } = periodPowers();
    expect(mass).toBe(0);
    expect(length).toBe(0.5);
    expect(gravity).toBe(-0.5);
    expect(length + gravity).toBe(0);
    expect(-2 * gravity).toBe(1);
  });

  it("swings a 1.00 m pendulum in 2.01 s and a 0.25 m one in half that", () => {
    expect(pendulumPeriod(1, BOBS.brass)).toBeCloseTo(2.006, 3);
    expect(pendulumPeriod(0.25, BOBS.brass)).toBeCloseTo(pendulumPeriod(1, BOBS.brass) / 2, 12);
  });

  it("keeps the period when the bob is ten times heavier", () => {
    expect(pendulumPeriod(0.8, BOBS.lead)).toBeCloseTo(pendulumPeriod(0.8, BOBS.wood), 12);
  });
});
