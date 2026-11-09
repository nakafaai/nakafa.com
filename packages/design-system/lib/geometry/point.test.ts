import { describe, expect, it } from "@effect/vitest";
import { pointsKey } from "@repo/design-system/lib/geometry/point";

describe("points key", () => {
  it("names a run of points by its coordinates, so equal runs share a key and others differ", () => {
    const edge = [
      { x: 0, y: 1, z: 0 },
      { x: 2.5, y: -1, z: 3 },
    ];

    expect(pointsKey(edge)).toBe("0,1,0 2.5,-1,3");
    expect(pointsKey([...edge])).toBe(pointsKey(edge));
    expect(pointsKey(Array.from(edge).reverse())).not.toBe(pointsKey(edge));
  });
});
