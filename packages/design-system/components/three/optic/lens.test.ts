import { describe, expect, it } from "@effect/vitest";
import {
  CROWN_INDEX,
  cellDrop,
  curvature,
  lensProfile,
  sag,
} from "@repo/design-system/components/three/optic/lens";
import { Array as Arr } from "effect";

describe("curvature", () => {
  it("follows the lensmaker's equation for a symmetric lens", () => {
    expect(curvature(15, 1.5)).toBeCloseTo(15, 12);
    expect(curvature(-10, CROWN_INDEX)).toBeCloseTo(-10.4, 12);
  });
});

describe("sag", () => {
  it("is how far a sphere stands proud of its chord", () => {
    expect(sag(5, 3)).toBeCloseTo(1, 12);
    expect(sag(-5, 4)).toBeCloseTo(2, 12);
  });

  it("stops at the sphere's own radius", () => {
    expect(sag(5, 9)).toBe(5);
  });
});

describe("lensProfile", () => {
  it("makes a converging lens thickest in the middle and as thin as asked at its rim", () => {
    const lens = lensProfile({ focal: 10, half: 3, index: 1.5, thin: 0.2 });
    const first = Arr.headNonEmpty(lens.points);
    const last = Arr.lastNonEmpty(lens.points);

    expect(lens.half).toBe(3);
    expect(lens.thickness).toBeCloseTo(0.2 + 2 * sag(10, 3), 12);
    expect(first[0]).toBe(0);
    expect(last[1] - first[1]).toBeCloseTo(lens.thickness, 12);
    expect(Math.max(...Arr.map(lens.points, (point) => point[0]))).toBe(3);
  });

  it("makes a diverging lens thinnest in the middle", () => {
    const lens = lensProfile({ focal: -10, half: 3, index: 1.5, thin: 0.2 });
    const first = Arr.headNonEmpty(lens.points);
    const last = Arr.lastNonEmpty(lens.points);

    expect(lens.thickness).toBe(0.2);
    expect(last[1] - first[1]).toBeCloseTo(0.2, 12);
  });

  it("narrows the aperture of a lens too strong to be that wide", () => {
    const lens = lensProfile({ focal: 2, half: 5, index: 1.5, thin: 0.1 });

    expect(lens.half).toBeCloseTo(1.88, 12);
  });
});

describe("cellDrop", () => {
  it("reaches below the axis by the lens, its cell and its stem", () => {
    expect(cellDrop({ focal: 10, half: 3, index: 1.5, thin: 0.2 })).toBeCloseTo(
      3.105,
      12
    );
    expect(cellDrop({ focal: 2, half: 5, index: 1.5, thin: 0.1 })).toBeCloseTo(
      1.985,
      12
    );
  });
});
