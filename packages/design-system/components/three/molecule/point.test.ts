import { describe, expect, it } from "@effect/vitest";
import {
  add,
  aside,
  cross,
  dot,
  grown,
  length,
  screw,
  sub,
  unit,
} from "@repo/design-system/components/three/molecule/point";

describe("vectors", () => {
  it("adds, subtracts and measures", () => {
    expect(add([1, 2, 3], [1, 1, 1])).toEqual([2, 3, 4]);
    expect(sub([1, 2, 3], [1, 1, 1])).toEqual([0, 1, 2]);
    expect(length([3, 4, 0])).toBe(5);
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it("keeps a vector of no length as it is", () => {
    expect(unit([0, 0, 0])).toEqual([0, 0, 0]);
    expect(unit([0, 0, 2])).toEqual([0, 0, 1]);
  });
});

describe("aside", () => {
  it("leans toward the given side, at right angles to the axis", () => {
    const side = aside([0, 0, 2], [3, 0, 5]);
    expect(side).toEqual([1, 0, 0]);
  });

  it("finds a perpendicular when the side lies along the axis", () => {
    const sideways = aside([0, 0, 1], [0, 0, 4]);
    expect(dot(sideways, [0, 0, 1])).toBeCloseTo(0, 9);
    expect(length(sideways)).toBeCloseTo(1, 9);
    const along = aside([1, 0, 0], [2, 0, 0]);
    expect(dot(along, [1, 0, 0])).toBeCloseTo(0, 9);
    expect(length(along)).toBeCloseTo(1, 9);
  });
});

describe("screw", () => {
  it("turns about z and lifts", () => {
    const [x, y, z] = screw([1, 0, 0], Math.PI / 2, 3);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(1, 9);
    expect(z).toBe(3);
  });
});

describe("grown", () => {
  it("puts an atom cis or trans by its torsion", () => {
    const place = (torsion: number) =>
      grown([1, 0, 0], [0, 0, 0], [0, 1, 0], 2, Math.PI / 2, torsion);
    const cis = place(0);
    expect(cis[0]).toBeCloseTo(1, 9);
    expect(cis[1]).toBeCloseTo(2, 9);
    const trans = place(Math.PI);
    expect(trans[1]).toBeCloseTo(-2, 9);
    expect(Math.abs(place(Math.PI / 2)[2])).toBeCloseTo(2, 9);
  });

  it("keeps the bond length and the bond angle", () => {
    const atom = grown([1, 0, 0], [0, 0, 0], [0, 1, 0], 1.5, 2, 1);
    const bond = sub(atom, [1, 0, 0]);
    expect(length(bond)).toBeCloseTo(1.5, 9);
    expect(dot(unit(bond), [-1, 0, 0])).toBeCloseTo(Math.cos(2), 9);
  });
});
