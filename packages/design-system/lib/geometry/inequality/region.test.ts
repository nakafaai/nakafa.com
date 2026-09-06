// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { createInequalityGeometry } from "@repo/design-system/lib/geometry/inequality/region";

const DOMAIN = {
  resolution: 2,
  xRange: [-1, 1],
  yRange: [-1, 1],
  zRange: [-1, 1],
} satisfies Parameters<typeof createInequalityGeometry>[0];

describe("inequality region geometry", () => {
  it("extrudes an included cell with all six correctly indexed faces", () => {
    const geometry = createInequalityGeometry({
      ...DOMAIN,
      resolution: 1,
      is2D: true,
      boundaryLine2D: [1, 1, -100],
    });
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.toArray()).toEqual([-1, -1, -1]);
    expect(geometry.boundingBox?.max.toArray()).toEqual([1, 1, 1]);
    expect(geometry.getAttribute("position").count).toBe(24);
    expect(geometry.getIndex()?.count).toBe(36);
    expect(
      Array.from(geometry.getAttribute("normal").array).every(Number.isFinite)
    ).toBe(true);
    geometry.dispose();
  });

  it.each([
    { resolution: 2, edge: 0 },
    { resolution: 80, edge: -0.25 },
  ])(
    "retains the sampled boundary threshold at resolution $resolution",
    ({ resolution, edge }) => {
      const geometry = createInequalityGeometry({
        ...DOMAIN,
        resolution,
        is2D: true,
        boundaryLine2D: [1, 0, 0.25],
      });
      geometry.computeBoundingBox();
      expect(geometry.boundingBox?.min.toArray()).toEqual([-1, -1, -1]);
      expect(geometry.boundingBox?.max.toArray()).toEqual([edge, 1, 1]);
      geometry.dispose();
    }
  );

  it("samples 3D cell centers in order and clips surface heights to the z range", () => {
    const samples: [number, number][] = [];
    const geometry = createInequalityGeometry({
      ...DOMAIN,
      resolution: 4,
      boundaryFunction: (x, y) => {
        samples.push([x, y]);
        return x + y + 0.5;
      },
    });
    expect(samples).toEqual([
      [-0.5, -0.5],
      [-0.5, 0.5],
      [0.5, -0.5],
      [0.5, 0.5],
    ]);
    expect(geometry.getAttribute("position").count).toBe(12);
    expect(geometry.getIndex()?.count).toBe(18);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.z).toBe(-0.5);
    expect(geometry.boundingBox?.max.z).toBe(0.5);
    geometry.dispose();
  });

  it.each([
    { is2D: true, boundaryLine2D: [1, 1, 100] },
    { is2D: true, boundaryLine2D: [0, 0, 1] },
    { boundaryFunction: () => Number.NaN },
    {},
  ] satisfies Partial<Parameters<typeof createInequalityGeometry>[0]>[])(
    "returns empty indexed geometry when the region has no sampled points: %j",
    (sampling) => {
      const geometry = createInequalityGeometry({ ...DOMAIN, ...sampling });
      expect(geometry.getAttribute("position").count).toBe(0);
      expect(geometry.getIndex()?.count).toBe(0);
      geometry.dispose();
    }
  );

  it("uses the linear inequality when both boundary forms are supplied", () => {
    const geometry = createInequalityGeometry({
      ...DOMAIN,
      is2D: true,
      boundaryLine2D: [0, 0, 0],
      boundaryFunction: () => 100,
    });
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.toArray()).toEqual([1, 1, 1]);
    geometry.dispose();
  });
});
