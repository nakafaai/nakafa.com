// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  depthAt,
  granaOf,
  LENS,
  lamellaeOf,
  PITCH,
  rimOf,
  specksOf,
  thylakoidsOf,
} from "@repo/design-system/components/contents/biology/chloroplast/grana";
import { Array as Arr } from "effect";

describe("the thylakoid system of a chloroplast", () => {
  it("stands its grana inside the lens, tallest in the middle", () => {
    const grana = granaOf();
    expect(grana.length).toBeGreaterThan(14);
    Arr.forEach(grana, (granum) => {
      expect(depthAt(granum.x, granum.z)).toBeGreaterThan(0);
      expect(granum.discs).toBeGreaterThanOrEqual(4);
      expect(granum.discs).toBeLessThanOrEqual(14);
      expect(granum.discs * PITCH).toBeLessThan(
        depthAt(granum.x, granum.z) * LENS[1] * 2
      );
    });
    const tallest = Arr.reduce(grana, grana[0], (best, granum) =>
      granum.discs > (best?.discs ?? 0) ? granum : best
    );
    expect(Math.abs(tallest?.x ?? 9)).toBeLessThan(LENS[0] / 2);
    expect(depthAt(LENS[0] * 2, 0)).toBe(0);
  });

  it("stacks one flattened sac for every thylakoid of every granum", () => {
    const grana = granaOf();
    const sacs = thylakoidsOf(grana);
    expect(sacs).toHaveLength(
      Arr.reduce(grana, 0, (sum, granum) => sum + granum.discs)
    );
    const first = grana[0];
    const [bottom, next] = sacs;
    expect((next?.at[1] ?? 0) - (bottom?.at[1] ?? 0)).toBeCloseTo(PITCH);
    expect(bottom?.at[1]).toBeCloseTo((-((first?.discs ?? 0) - 1) / 2) * PITCH);
    expect(bottom?.size[1]).toBeLessThan(PITCH / 2);
  });

  it("joins neighbouring grana with stroma lamellae and no others", () => {
    const near = { discs: 9, radius: 0.1, x: 0, z: 0 };
    const beside = { discs: 6, radius: 0.1, x: 0.3, z: 0 };
    const far = { discs: 9, radius: 0.1, x: 0.9, z: 0.3 };
    const lamellae = lamellaeOf([near, beside, far]);
    expect(lamellae).toHaveLength(2);
    Arr.forEach(lamellae, (lamella) => {
      expect(lamella.at[0]).toBeCloseTo(0.15);
      expect(lamella.size[0]).toBeCloseTo(0.15);
      expect(lamella.turn).toBeCloseTo(0);
    });
    expect(lamellaeOf(granaOf()).length).toBeGreaterThan(20);
  });

  it("cuts the envelope round the front and over the top", () => {
    const rim = rimOf(8);
    expect(rim).toHaveLength(16);
    Arr.forEach(rim, ([x, y, z]) => {
      expect(Math.hypot(x, y, z)).toBeCloseTo(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(z).toBeGreaterThanOrEqual(-1e-9);
    });
    expect(rim[0]).toEqual([1, 0, 0]);
    expect(rim[8]?.[0]).toBeCloseTo(-1);
  });

  it("scatters the stroma's small bodies through the lower half of the lens", () => {
    const specks = specksOf(60, 4);
    expect(specks).toHaveLength(60);
    Arr.forEach(specks, ([x, y, z]) => {
      expect(y).toBeLessThanOrEqual(0);
      expect(-y).toBeLessThanOrEqual(depthAt(x, z) * LENS[1]);
    });
    expect(specksOf(60, 4)).toEqual(specks);
  });
});
