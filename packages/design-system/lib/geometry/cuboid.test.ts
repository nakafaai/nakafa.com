import { describe, expect, it } from "@effect/vitest";
import { createCuboid } from "@repo/design-system/lib/geometry/cuboid";
import { Array as Arr, Order } from "effect";

describe("createCuboid", () => {
  it("creates eight exact vertices around an authored center", () => {
    const cuboid = createCuboid({
      center: { x: 1, y: 2, z: 3 },
      height: 4,
      length: 6,
      width: 8,
    });

    expect(cuboid.vertices).toHaveLength(8);
    expect(cuboid.vertices).toContainEqual({ x: -2, y: 0, z: -1 });
    expect(cuboid.vertices).toContainEqual({ x: 4, y: 4, z: 7 });
  });

  it("creates twelve unique straight axis-aligned edges", () => {
    const { edges } = createCuboid({ height: 4, length: 6, width: 8 });
    const identities = Arr.map(edges, ([start, end]) =>
      Arr.join(
        Arr.sort(
          Arr.map([start, end], ({ x, y, z }) => `${x},${y},${z}`),
          Order.String
        ),
        "|"
      )
    );

    expect(edges).toHaveLength(12);
    expect(Arr.dedupe(identities).length).toBe(12);
    for (const [start, end] of edges) {
      const changedAxes = Arr.filter(
        [start.x !== end.x, start.y !== end.y, start.z !== end.z],
        Boolean
      );
      expect(changedAxes).toHaveLength(1);
    }
  });

  it("connects every vertex to exactly three edges", () => {
    const { edges, vertices } = createCuboid({
      height: 4,
      length: 6,
      width: 8,
    });

    for (const vertex of vertices) {
      const degree = Arr.filter(
        edges,
        ([start, end]) => start === vertex || end === vertex
      ).length;
      expect(degree).toBe(3);
    }
  });

  it("keeps every positive finite dimension non-degenerate", () => {
    const minimum = Number.MIN_VALUE;
    const { edges, vertices } = createCuboid({
      height: minimum,
      length: minimum,
      width: minimum,
    });

    expect(Arr.dedupe(Arr.map(vertices, ({ x }) => x))).toHaveLength(2);
    expect(Arr.dedupe(Arr.map(vertices, ({ y }) => y))).toHaveLength(2);
    expect(Arr.dedupe(Arr.map(vertices, ({ z }) => z))).toHaveLength(2);
    expect(edges).toHaveLength(12);
    for (const [from, to] of edges) {
      expect(from).not.toEqual(to);
    }
  });
});
