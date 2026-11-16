import { describe, expect, it } from "@effect/vitest";
import {
  advanceProgress,
  bondStrengths,
  particlePosition,
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

  it("runs on while playing and starts over after the pause at the end", () => {
    expect(advanceProgress(0.5, REACTION_SECONDS / 10)).toBeCloseTo(0.6, 9);
    expect(advanceProgress(1.1, 1)).toBe(0);
  });
});
