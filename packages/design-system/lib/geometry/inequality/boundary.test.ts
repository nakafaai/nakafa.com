// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { sampleInequalityBoundary } from "@repo/design-system/lib/geometry/inequality/boundary";

const DOMAIN = {
  resolution: 2,
  xRange: [-1, 1],
  yRange: [-1, 1],
  zRange: [-1, 1],
} satisfies Parameters<typeof sampleInequalityBoundary>[0];

describe("inequality boundary segments", () => {
  it("keeps the horizontal plane's edge pairs and vertical connectors", () => {
    const points = sampleInequalityBoundary({
      ...DOMAIN,
      is2D: true,
      boundaryLine2D: [0, 1, 0],
    });
    expect(points).toHaveLength(14);
    expect(points.slice(0, 4)).toEqual([
      [-1, 0, -1],
      [0, -0, -1],
      [-1, 0, 1],
      [0, -0, 1],
    ]);
    expect(points.slice(-2)).toEqual([
      [1, -0, -1],
      [1, -0, 1],
    ]);
  });

  it("retains the vertical plane's two parallel edge paths", () => {
    const points = sampleInequalityBoundary({
      ...DOMAIN,
      is2D: true,
      boundaryLine2D: [1, 0, 0],
    });
    expect(points).toHaveLength(8);
    expect(points.slice(0, 4)).toEqual([
      [0, -1, -1],
      [-0, 0, -1],
      [0, -1, 1],
      [-0, 0, 1],
    ]);
  });

  it("clips a diagonal plane to both horizontal domain ranges", () => {
    const points = sampleInequalityBoundary({
      ...DOMAIN,
      resolution: 4,
      is2D: true,
      boundaryLine2D: [1, 1, 1],
    });
    expect(points).toHaveLength(14);
    expect(
      points.every(
        ([x, y, z]) =>
          x >= -1 && x <= 1 && y >= -1 && y <= 1 && Math.abs(z) === 1
      )
    ).toBe(true);
  });

  it("caps boundary density independently of the filled region", () => {
    const points = sampleInequalityBoundary({
      ...DOMAIN,
      resolution: 200,
      is2D: true,
      boundaryLine2D: [0, 1, 0],
    });
    expect(points).toHaveLength(394);
  });

  it("sweeps a clipped surface along x before y and retains endpoint pairs", () => {
    const points = sampleInequalityBoundary({
      ...DOMAIN,
      boundaryFunction: (x, y) => x + y,
    });
    expect(points).toHaveLength(16);
    expect(points.slice(0, 4)).toEqual([
      [0, -1, -1],
      [1, -1, 0],
      [-1, 0, -1],
      [0, 0, 0],
    ]);
    expect(points.slice(-4)).toEqual([
      [0, 0, 0],
      [0, 1, 1],
      [1, -1, 0],
      [1, 0, 1],
    ]);
  });

  it.each([
    {},
    { is2D: true, boundaryLine2D: [0, 0, 0] },
    { is2D: true, boundaryLine2D: [1e-11, 1e-11, 1] },
    { boundaryFunction: () => Number.NaN },
  ] satisfies Partial<Parameters<typeof sampleInequalityBoundary>[0]>[])(
    "has no drawable segments for a missing or unresolvable boundary: %j",
    (sampling) => {
      expect(sampleInequalityBoundary({ ...DOMAIN, ...sampling })).toEqual([]);
    }
  );
});
