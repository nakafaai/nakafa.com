// @vitest-environment node
import { createCuboidLines } from "@repo/design-system/components/contents/mathematics/cuboid";
import { describe, expect, it } from "vitest";

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
      width: 8,
    });

    expect(lines).toHaveLength(12);
    expect(lines.map(getEdgeLength).sort((a, b) => a - b)).toEqual([
      4, 4, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8,
    ]);
    expect(lines).toSatisfy((edges: typeof lines) =>
      edges.every(
        (edge) =>
          edge.color === "slategray" &&
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
    const vertices = lines.flatMap((line) => line.points);

    expect(new Set(vertices.map(({ x }) => x))).toEqual(new Set([-2, 2]));
    expect(new Set(vertices.map(({ y }) => y))).toEqual(new Set([-3, 3]));
    expect(new Set(vertices.map(({ z }) => z))).toEqual(new Set([-4, 4]));
  });
});
