import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { meshGrid } from "@/lib/island/mesh";
import { drawModel } from "@/lib/island/voxel";

/** The normals of each quad of a mesh, one per quad. */
function quadNormals(normals: Float32Array) {
  return Arr.makeBy(normals.length / 12, (quad) =>
    Arr.fromIterable(normals.subarray(quad * 12, quad * 12 + 3))
  );
}

describe("island mesh", () => {
  it("draws nothing for an empty grid", () => {
    const mesh = meshGrid(drawModel([2, 2, 2], []));
    expect(mesh.indices).toHaveLength(0);
    expect(mesh.positions).toHaveLength(0);
  });

  it("draws one voxel as six quads facing out, two triangles each", () => {
    const mesh = meshGrid(
      drawModel(
        [1, 1, 1],
        [
          {
            _tag: "box",
            from: [0, 0, 0],
            ramp: "stone",
            to: [0, 0, 0],
            tone: 1,
          },
        ]
      )
    );
    expect(mesh.indices).toHaveLength(36);
    expect(mesh.colors).toHaveLength(24);
    expect(quadNormals(mesh.normals)).toEqual(
      expect.arrayContaining([
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ])
    );
  });

  it("merges a run of one colour into one quad a side, and splits where the colour changes", () => {
    const one = meshGrid(
      drawModel(
        [8, 1, 1],
        [
          {
            _tag: "box",
            from: [0, 0, 0],
            ramp: "stone",
            to: [7, 0, 0],
            tone: 1,
          },
        ]
      )
    );
    expect(one.indices.length / 6).toBe(6);
    const two = meshGrid(
      drawModel(
        [8, 1, 1],
        [
          {
            _tag: "box",
            from: [0, 0, 0],
            ramp: "stone",
            to: [3, 0, 0],
            tone: 1,
          },
          {
            _tag: "box",
            from: [4, 0, 0],
            ramp: "wood",
            to: [7, 0, 0],
            tone: 1,
          },
        ]
      )
    );
    expect(two.indices.length / 6).toBe(10);
  });

  it("winds every quad so its front faces its normal", () => {
    const mesh = meshGrid(
      drawModel(
        [2, 2, 2],
        [
          {
            _tag: "box",
            from: [0, 0, 0],
            ramp: "stone",
            to: [1, 1, 1],
            tone: 1,
          },
        ]
      )
    );
    const read = (array: Float32Array, index: number) => array[index] ?? 0;
    for (let quad = 0; quad < mesh.indices.length / 6; quad += 1) {
      const p = (corner: number, axis: number) =>
        read(mesh.positions, (quad * 4 + corner) * 3 + axis);
      const u = [
        p(1, 0) - p(0, 0),
        p(1, 1) - p(0, 1),
        p(1, 2) - p(0, 2),
      ] as const;
      const v = [
        p(2, 0) - p(0, 0),
        p(2, 1) - p(0, 1),
        p(2, 2) - p(0, 2),
      ] as const;
      const n = (axis: number) => read(mesh.normals, quad * 12 + axis);
      const facing =
        (u[1] * v[2] - u[2] * v[1]) * n(0) +
        (u[2] * v[0] - u[0] * v[2]) * n(1) +
        (u[0] * v[1] - u[1] * v[0]) * n(2);
      expect(facing).toBeGreaterThan(0);
    }
  });

  it("grows its buffers past their first size", () => {
    const grid = drawModel(
      [40, 1, 40],
      [
        {
          _tag: "box",
          from: [0, 0, 0],
          jitter: 1,
          ramp: "grass",
          to: [39, 0, 39],
          tone: 1,
        },
      ],
      2
    );
    const mesh = meshGrid(grid);
    expect(mesh.positions.length).toBeGreaterThan(4096);
    expect(mesh.positions.length / 3).toBe(mesh.colors.length);
  });
});
