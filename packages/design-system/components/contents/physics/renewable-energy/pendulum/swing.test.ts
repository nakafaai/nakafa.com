import { describe, expect, it } from "@effect/vitest";
import {
  DURATION,
  RELEASE,
  START_ENERGY,
  simulateSwing,
  swingAt,
  swingEnergies,
} from "@repo/design-system/components/contents/physics/renewable-energy/pendulum/swing";
import { Array as Arr } from "effect";

/** The sum of the three stores at one moment. */
function total(energies: ReturnType<typeof swingEnergies>) {
  return energies.potential + energies.kinetic + energies.heat;
}

describe("swinging bob", () => {
  it("starts with m g L (1 - cos 40°), about 4.59 J", () => {
    expect(START_ENERGY).toBeCloseTo(4.5855, 3);
  });

  it("keeps its mechanical energy without drag, never swinging past the release angle", () => {
    const run = simulateSwing("none");
    for (const state of run) {
      expect(total(swingEnergies(state))).toBeCloseTo(START_ENERGY, 6);
      expect(Math.abs(state.angle)).toBeLessThanOrEqual(RELEASE + 1e-9);
      expect(state.heat).toBe(0);
    }
  });

  it("swings back to its release after one period, about 2.93 s at 40°", () => {
    const run = simulateSwing("none");
    expect(swingAt(run, 2.925).angle).toBeCloseTo(RELEASE, 2);
    expect(swingAt(run, 2.925 / 2).angle).toBeCloseTo(-RELEASE, 2);
  });

  it("hands mechanical energy to the air as heat, the total staying the same", () => {
    for (const drag of ["light", "strong"] as const) {
      const run = simulateSwing(drag);
      for (const state of run) {
        expect(total(swingEnergies(state))).toBeCloseTo(START_ENERGY, 5);
      }
      const end = swingEnergies(swingAt(run, DURATION));
      expect(end.heat).toBeGreaterThan(0);
      expect(end.potential + end.kinetic).toBeLessThan(START_ENERGY);
    }
  });

  it("loses more to strong drag than to light drag", () => {
    const light = swingEnergies(swingAt(simulateSwing("light"), 10));
    const strong = swingEnergies(swingAt(simulateSwing("strong"), 10));
    expect(strong.heat).toBeGreaterThan(light.heat);
  });

  it("reads the first and last moments for times outside the run", () => {
    const run = simulateSwing("light");
    expect(swingAt(run, -1)).toBe(Arr.getUnsafe(run, 0));
    expect(swingAt(run, DURATION + 5)).toBe(Arr.getUnsafe(run, run.length - 1));
  });
});
