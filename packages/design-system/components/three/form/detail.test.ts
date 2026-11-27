import { describe, expect, it } from "@effect/vitest";
import {
  grainOf,
  sidesFor,
  stepFor,
} from "@repo/design-system/components/three/form/detail";

describe("grainOf", () => {
  it("is finer on a desktop than on a phone, and scales with the lab's reach", () => {
    expect(grainOf("full", 1)).toBeLessThan(grainOf("light", 1));
    expect(grainOf("light", 1)).toBeLessThan(grainOf("low", 1));
    expect(grainOf("low", 1)).toBeLessThan(grainOf("plain", 1));
    expect(grainOf("full", 10)).toBeCloseTo(grainOf("full", 1) * 10, 12);
  });
});

describe("stepFor", () => {
  it("keeps every chord of an arc within the grain", () => {
    const step = stepFor(0.001, 0.5);
    expect(0.5 * (1 - Math.cos(step / 2))).toBeCloseTo(0.001, 9);
  });

  it("never steps finer than two degrees or coarser than an eighth of a turn", () => {
    expect(stepFor(1e-9, 1)).toBeCloseTo(Math.PI / 90, 12);
    expect(stepFor(1, 0.001)).toBeCloseTo(Math.PI / 4, 12);
    expect(stepFor(1, 0)).toBeCloseTo(Math.PI / 4, 12);
  });
});

describe("sidesFor", () => {
  it("gives a large section more sides than a wire, in fours, within its bounds", () => {
    const grain = grainOf("full", 1);
    const wire = sidesFor(grain, 0.002);
    const beaker = sidesFor(grain, 0.05);
    expect(wire).toBeGreaterThanOrEqual(8);
    expect(beaker).toBeGreaterThan(wire);
    expect(wire % 4).toBe(0);
    expect(beaker % 4).toBe(0);
    expect(sidesFor(grain, 0)).toBe(8);
    expect(sidesFor(1e-12, 1)).toBe(96);
  });

  it("gives a phone fewer sides than a desktop for the same part", () => {
    expect(sidesFor(grainOf("low", 1), 0.05)).toBeLessThan(
      sidesFor(grainOf("full", 1), 0.05)
    );
  });
});
