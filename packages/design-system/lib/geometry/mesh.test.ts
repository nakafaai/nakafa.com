import { describe, expect, it } from "@effect/vitest";
import {
  faceMesh,
  fanMesh,
  gridMesh,
  meshGeometry,
} from "@repo/design-system/lib/geometry/mesh";
import { Option } from "effect";

const p = (x: number, y: number, z = 0) => ({ x, y, z });

describe("mesh arrays", () => {
  it("fans every convex shape from its first corner into one mesh", () => {
    const mesh = fanMesh([
      [p(0, 0), p(1, 0), p(1, 1), p(0, 1)],
      [p(2, 0), p(3, 0), p(2, 1)],
    ]);

    expect(Array.from(mesh.indices)).toStrictEqual([0, 1, 2, 0, 2, 3, 4, 5, 6]);
    expect(mesh.positions.length).toBe(21);
  });

  it("leaves a hole where a grid corner is undefined", () => {
    const mesh = gridMesh({
      columns: 2,
      points: [
        Option.some(p(0, 0)),
        Option.some(p(1, 0)),
        Option.some(p(2, 0)),
        Option.some(p(0, 1)),
        Option.some(p(1, 1)),
        Option.none(),
      ],
      rows: 1,
    });

    expect(Array.from(mesh.indices)).toStrictEqual([0, 1, 4, 0, 4, 3]);
    expect(Array.from(mesh.positions.slice(15, 18))).toStrictEqual([0, 0, 0]);
  });

  it("triangulates every face of a solid, concave ones included", () => {
    const mesh = faceMesh([
      [p(0, 0), p(2, 0), p(2, 2), p(1, 1), p(0, 2)],
      [p(0, 0, 0), p(0, 0, 1), p(0, 1, 1)],
    ]);

    expect(mesh.indices.length).toBe(12);
    expect(Math.max(...mesh.indices)).toBe(7);
  });

  it("builds a buffer geometry with positions, indices and one normal per vertex", () => {
    const geometry = meshGeometry(fanMesh([[p(0, 0), p(1, 0), p(0, 1)]]));

    expect(geometry.getAttribute("position").count).toBe(3);
    expect(Array.from(geometry.getIndex()?.array ?? [])).toStrictEqual([
      0, 1, 2,
    ]);
    expect(Array.from(geometry.getAttribute("normal").array)).toStrictEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
    ]);
  });
});
