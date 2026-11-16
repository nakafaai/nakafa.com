import { describe, expect, it } from "@effect/vitest";
import {
  circlePath,
  pathStrip,
  throughPath,
} from "@repo/design-system/components/three/stage/strip";
import { Array as Arr } from "effect";

/** Reads one corner of a strip as its place on the ground. */
function corner(positions: Float32Array, index: number) {
  return [positions[index * 3], positions[index * 3 + 2]] as const;
}

describe("pathStrip", () => {
  it("lays a straight strip between its two offsets and counts its length", () => {
    const strip = pathStrip(
      [
        [0, 0],
        [4, 0],
      ],
      false,
      -1,
      1
    );
    expect(strip.length).toBe(4);
    expect(corner(strip.positions, 0)).toEqual([0, -1]);
    expect(corner(strip.positions, 1)).toEqual([0, 1]);
    expect(corner(strip.positions, 2)).toEqual([4, -1]);
    expect(corner(strip.positions, 3)).toEqual([4, 1]);
    expect(Array.from(strip.uvs)).toEqual([0, 0, 0, 1, 4, 0, 4, 1]);
    expect(strip.indices).toEqual([0, 1, 2, 2, 1, 3]);
  });

  it("keeps its width around a right bend by mitring the corner", () => {
    const strip = pathStrip(
      [
        [0, 0],
        [4, 0],
        [4, 3],
      ],
      false,
      -1,
      1
    );
    expect(strip.length).toBe(7);
    const [innerX, innerZ] = corner(strip.positions, 3);
    const [outerX, outerZ] = corner(strip.positions, 2);
    expect(innerX).toBeCloseTo(3, 6);
    expect(innerZ).toBeCloseTo(1, 6);
    expect(outerX).toBeCloseTo(5, 6);
    expect(outerZ).toBeCloseTo(-1, 6);
  });

  it("closes a loop onto its own start, with the whole way round as its length", () => {
    const square = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ] as const;
    const strip = pathStrip(square, true, -0.5, 0.5);
    expect(strip.length).toBe(8);
    expect(strip.positions).toHaveLength(5 * 6);
    expect(corner(strip.positions, 0)[0]).toBeCloseTo(
      corner(strip.positions, 8)[0],
      6
    );
    expect(corner(strip.positions, 1)[1]).toBeCloseTo(
      corner(strip.positions, 9)[1],
      6
    );
    expect(corner(strip.positions, 1)).toEqual([0.5, 0.5]);
  });
});

describe("circlePath", () => {
  it("places every step at the radius, starting on the x axis", () => {
    const path = circlePath(3, 8);
    expect(path).toHaveLength(8);
    expect(path[0]).toEqual([3, 0]);
    for (const [x, z] of path) {
      expect(Math.hypot(x, z)).toBeCloseTo(3, 10);
    }
  });
});

describe("throughPath", () => {
  it("carries a path on along its first and last legs", () => {
    const path = throughPath(
      [
        [0, 0],
        [4, 0],
        [4, 3],
      ],
      10
    );
    expect(Arr.map(path, ([x, z]) => [x, z])).toEqual([
      [-10, 0],
      [0, 0],
      [4, 0],
      [4, 3],
      [4, 13],
    ]);
  });
});
