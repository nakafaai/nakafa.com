import { describe, expect, it } from "@effect/vitest";
import {
  advanceProgress,
  bondStrengths,
  particlePosition,
  REACTION_HOLD_SECONDS,
  REACTION_SECONDS,
} from "@repo/design-system/components/contents/chemistry/equation/progress";

const particle = {
  element: "H",
  end: [4, 2, 0],
  product: 0,
  reactant: 0,
  start: [-4, 0, 0],
} as const;

describe("reaction progress", () => {
  it("holds every atom in its reactant before the bonds break", () => {
    expect(particlePosition(particle, 0)).toEqual([-4, 0, 0]);
    expect(bondStrengths(0)).toEqual({ products: 0, reactants: 1 });
  });

  it("lifts an atom off the plane halfway along its path", () => {
    const [x, y, z] = particlePosition(particle, 0.53);

    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(1, 9);
    expect(z).toBeCloseTo(0.9, 9);
  });

  it("ends every atom in its product with the new bonds whole", () => {
    expect(particlePosition(particle, 1)).toEqual([4, 2, 0]);
    expect(bondStrengths(1)).toEqual({ products: 1, reactants: 0 });
  });

  it("runs on while playing, holds cleanly at 1 without overshooting, and restarts after the pause", () => {
    const mid = advanceProgress({ hold: 0, value: 0.5 }, REACTION_SECONDS / 10);
    expect(mid.value).toBeCloseTo(0.6, 9);
    expect(mid.hold).toBe(0);

    const end = advanceProgress({ hold: 0, value: 0.95 }, REACTION_SECONDS);
    expect(end).toEqual({ hold: 0, value: 1 });

    const holding = advanceProgress(end, REACTION_HOLD_SECONDS / 2);
    expect(holding.value).toBe(1);
    expect(holding.hold).toBeCloseTo(REACTION_HOLD_SECONDS / 2, 9);

    const restarted = advanceProgress(holding, REACTION_HOLD_SECONDS);
    expect(restarted).toEqual({ hold: 0, value: 0 });
  });
});
