import { describe, expect, it } from "@effect/vitest";
import { stitch } from "@repo/design-system/components/three/form/mesh";

describe("stitch", () => {
  it("joins two rows with two triangles a side, wound the same way", () => {
    expect(Array.from(stitch(2, [1, 1], []))).toEqual([
      0, 1, 3, 3, 1, 4, 1, 2, 4, 4, 2, 5,
    ]);
  });

  it("joins a pinched row with one triangle a side", () => {
    expect(Array.from(stitch(2, [0, 1], []))).toEqual([3, 1, 4, 4, 2, 5]);
    expect(Array.from(stitch(2, [1, 0], []))).toEqual([0, 1, 3, 1, 2, 4]);
  });

  it("leaves a break between two rows that keep a crisp edge", () => {
    expect(stitch(2, [1, 1, 1], [0])).toHaveLength(12);
    expect(Array.from(stitch(2, [1, 1, 1], [0, 1]))).toEqual([]);
  });

  it("indexes with 32 bits only when a surface has more vertices than 16 bits reach", () => {
    expect(stitch(2, [1, 1], [])).toBeInstanceOf(Uint16Array);
    expect(
      stitch(
        255,
        Array.from({ length: 257 }, () => 1),
        []
      )
    ).toBeInstanceOf(Uint32Array);
  });
});
