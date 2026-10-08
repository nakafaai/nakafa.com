// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { createCuboidLines } from "@repo/design-system/components/contents/mathematics/cuboid";
import { Array as Arr, Order } from "effect";

function getEdgeLength({
  points,
}: ReturnType<typeof createCuboidLines>[number]) {
  const [start, end] = points;

  if (!(start && end)) {
    return 0;
  }

  return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}

describe("cuboid visual geometry", () => {
  it("creates twelve straight edges with four of every declared dimension", () => {
    const lines = createCuboidLines({
      center: { x: 2, y: 3, z: 4 },
      color: "slategray",
      height: 6,
      kind: "cuboid",
      length: 4,
      lineWidth: 2,
      width: 8,
    });

    expect(lines).toHaveLength(12);
    expect(Arr.sort(Arr.map(lines, getEdgeLength), Order.Number)).toEqual([
      4, 4, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8,
    ]);
    expect(lines).toSatisfy((edges: typeof lines) =>
      Arr.every(
        edges,
        (edge) =>
          edge.color === "slategray" &&
          edge.lineWidth === 2 &&
          edge.points.length === 2 &&
          edge.showPoints === false &&
          edge.smooth === false
      )
    );
  });

  it("centers omitted coordinates on the exact origin extents", () => {
    const lines = createCuboidLines({
      height: 6,
      kind: "cuboid",
      length: 4,
      width: 8,
    });
    const vertices = Arr.flatMap(lines, (line) => line.points);

    expect(
      Arr.sort(Arr.dedupe(Arr.map(vertices, ({ x }) => x)), Order.Number)
    ).toEqual([-2, 2]);
    expect(
      Arr.sort(Arr.dedupe(Arr.map(vertices, ({ y }) => y)), Order.Number)
    ).toEqual([-3, 3]);
    expect(
      Arr.sort(Arr.dedupe(Arr.map(vertices, ({ z }) => z)), Order.Number)
    ).toEqual([-4, 4]);
  });
});
