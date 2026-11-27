import { describe, expect, it } from "@effect/vitest";
import {
  drape,
  FLAT_REACHES,
  landGrid,
  reliefAt,
} from "@repo/design-system/components/three/stage/relief";
import { Array as Arr } from "effect";

/** Places on a circle of one radius around the lab. */
function around(radius: number) {
  return Arr.makeBy(48, (index) => {
    const angle = (index / 48) * 2 * Math.PI;
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as const;
  });
}

describe("reliefAt", () => {
  it("lies dead flat where the lab stands", () => {
    for (const radius of [0, 0.5, 1, 0.999 * FLAT_REACHES]) {
      for (const [x, z] of around(radius)) {
        expect(reliefAt(x, z, 0.2)).toBe(0);
      }
    }
  });

  it("rolls both above and below the floor far from the lab, within its rise", () => {
    const heights = Arr.flatMap([6, 8, 10, 12], (radius) =>
      Arr.map(around(radius), ([x, z]) => reliefAt(x, z, 0.2))
    );

    expect(Math.max(...heights)).toBeGreaterThan(0.04);
    expect(Math.min(...heights)).toBeLessThan(-0.04);
    expect(Math.max(...Arr.map(heights, Math.abs))).toBeLessThan(0.4);
  });

  it("swells from the flat with no step", () => {
    for (const [x, z] of around(FLAT_REACHES + 0.05)) {
      expect(Math.abs(reliefAt(x, z, 0.2))).toBeLessThan(0.0005);
    }
  });

  it("answers the same height on every visit and none for ground that does not rise", () => {
    expect(reliefAt(7.3, -4.1, 0.16)).toBe(reliefAt(7.3, -4.1, 0.16));
    expect(reliefAt(7.3, -4.1, 0)).toBe(0);
  });
});

describe("landGrid", () => {
  const grid = landGrid(16, 2, 5, 12, (x, z) => 0.1 * x + 0.01 * z);

  it("covers the ground from its middle to its rim, finest near the lab", () => {
    const { positions } = grid;
    const radii = Arr.makeBy(6, (ring) =>
      Math.hypot(
        Number(positions[(1 + ring * 12) * 3]),
        Number(positions[(1 + ring * 12) * 3 + 2])
      )
    );

    expect(positions).toHaveLength((1 + 6 * 12) * 3);
    expect(radii[0]).toBeCloseTo(2, 5);
    expect(radii[5]).toBeCloseTo(16, 4);
    expect(radii[1] - radii[0]).toBeLessThan(radii[5] - radii[4]);
  });

  it("stands every vertex on the ground and maps textures by its place", () => {
    const { positions, uvs } = grid;

    for (const vertex of Arr.makeBy(1 + 6 * 12, (each) => each)) {
      const x = Number(positions[vertex * 3]);
      const z = Number(positions[vertex * 3 + 2]);
      expect(Number(positions[vertex * 3 + 1])).toBeCloseTo(
        0.1 * x + 0.01 * z,
        5
      );
      expect(Number(uvs[vertex * 2])).toBe(x);
      expect(Number(uvs[vertex * 2 + 1])).toBe(z);
    }
  });

  it("faces every triangle up and leaves no gap around the ring", () => {
    const { indices, positions } = landGrid(16, 2, 5, 12, () => 0);
    const at = (vertex: number) =>
      [
        Number(positions[vertex * 3]),
        Number(positions[vertex * 3 + 2]),
      ] as const;
    const areas = Arr.makeBy(indices.length / 3, (triangle) => {
      const [ax, az] = at(Number(indices[triangle * 3]));
      const [bx, bz] = at(Number(indices[triangle * 3 + 1]));
      const [cx, cz] = at(Number(indices[triangle * 3 + 2]));
      // The upward part of the cross product: positive when the triangle faces up.
      return ((bz - az) * (cx - ax) - (bx - ax) * (cz - az)) / 2;
    });

    expect(indices).toHaveLength((12 + 5 * 12 * 2) * 3);
    expect(Math.min(...areas)).toBeGreaterThan(0);
    expect(Arr.reduce(areas, 0, (sum, area) => sum + area)).toBeCloseTo(
      // A regular twelve-sided sheet of radius 16.
      6 * 16 * 16 * Math.sin(Math.PI / 6),
      2
    );
  });
});

describe("drape", () => {
  it("lifts every vertex by the height of the ground under it", () => {
    const positions = Float32Array.from([1, 0.5, 2, -3, 0, 4]);

    expect(Array.from(drape(positions, (x, z) => x + z))).toEqual([
      1, 3.5, 2, -3, 1, 4,
    ]);
  });
});
