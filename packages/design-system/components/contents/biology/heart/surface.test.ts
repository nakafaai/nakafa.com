// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { surfaceNets } from "@repo/design-system/components/contents/biology/heart/surface";
import { Array as Arr } from "effect";

/** A ball of radius 2.5 at the origin. */
const ball = (x: number, y: number, z: number) =>
  Math.sqrt(x * x + y * y + z * z) - 2.5;

describe("a surface net", () => {
  const cell = 0.1;
  const mesh = surfaceNets(ball, [-3, -3, -3], [3, 3, 3], cell);
  const point = (index: number) =>
    [
      mesh.positions[index * 3] ?? 0,
      mesh.positions[index * 3 + 1] ?? 0,
      mesh.positions[index * 3 + 2] ?? 0,
    ] as const;

  it("lays every vertex on the surface to within a cell", () => {
    const count = mesh.positions.length / 3;
    expect(count).toBeGreaterThan(1000);
    expect(
      Arr.every(Arr.range(0, count - 1), (index) => {
        const [x, y, z] = point(index);
        return Math.abs(ball(x, y, z)) < cell;
      })
    ).toBe(true);
  });

  it("closes the skin with triangles that face outward", () => {
    const triangles = mesh.indices.length / 3;
    expect(triangles).toBeGreaterThan(2000);
    expect(
      Arr.every(Arr.range(0, triangles - 1), (triangle) => {
        const [ax, ay, az] = point(mesh.indices[triangle * 3] ?? 0);
        const [bx, by, bz] = point(mesh.indices[triangle * 3 + 1] ?? 0);
        const [cx, cy, cz] = point(mesh.indices[triangle * 3 + 2] ?? 0);
        const ux = bx - ax;
        const uy = by - ay;
        const uz = bz - az;
        const vx = cx - ax;
        const vy = cy - ay;
        const vz = cz - az;
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        return (
          nx * (ax + bx + cx) + ny * (ay + by + cy) + nz * (az + bz + cz) > 0
        );
      })
    ).toBe(true);
  });

  it("finds nothing in a box the surface never enters", () => {
    const empty = surfaceNets(ball, [5, 5, 5], [7, 7, 7], 0.25);
    expect(empty.positions.length).toBe(0);
    expect(empty.indices.length).toBe(0);
  });
});
