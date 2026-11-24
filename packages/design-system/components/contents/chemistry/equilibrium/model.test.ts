// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  evaluateDynamic,
  MAX_SIMULATION_TIME,
  sampleRateCurves,
} from "@repo/design-system/components/contents/chemistry/equilibrium/model";

describe("dynamic equilibrium lab model", () => {
  it("starts out of balance and converges to equal nonzero forward and reverse rates", () => {
    const start = evaluateDynamic(1, 0.6, 0.4, 0);
    expect(start.state).toBe("approaching");
    expect(start.forwardRate).toBeGreaterThan(start.reverseRate);
    expect(start.equilibriumRatio).toBe(1.5);

    const steady = evaluateDynamic(1, 0.6, 0.4, MAX_SIMULATION_TIME);
    expect(steady.state).toBe("balanced");
    expect(steady.forwardRate).toBeCloseTo(steady.reverseRate, 1);
    expect(
      steady.reactantConcentration + steady.productConcentration
    ).toBeCloseTo(1, 2);
  });

  it("samples convergent forward and reverse rate curves", () => {
    const curve = sampleRateCurves(1, 0.6, 0.4);
    expect(curve).toHaveLength(33);
    expect(curve[0].forward).toBeGreaterThan(curve[0].reverse);
    expect(Math.abs(curve[32].forward - curve[32].reverse)).toBeLessThan(0.05);
    expect(sampleRateCurves(1, 0.6, 0.4, 8)).toHaveLength(9);
  });
});
