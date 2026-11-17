// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { flatQuads, ninaAt, standingQuad } from "@/lib/island/flat";
import { STRIDE } from "@/lib/island/mesh";
import { SEA_LEVEL } from "@/lib/island/world";

describe("island/flat", () => {
  it("swims Nina around the island past its footprint, facing along her loop, flat on the sea and beating her tail", () => {
    const middle = 32;
    for (const time of [0, 7, 19, 40, 83]) {
      const nina = ninaAt(32, time);
      const reach = Math.hypot(nina.x - middle, nina.z - middle);
      expect(reach).toBeGreaterThan(16 + 0.7);
      expect(reach).toBeLessThan(16 + 3.3);
      const later = ninaAt(32, time + 0.01);
      expect(Math.atan2(later.z - nina.z, later.x - nina.x)).toBeCloseTo(
        nina.heading,
        1
      );
    }
    const alone = flatQuads(32, 0);
    expect(alone.indices).toEqual(new Uint32Array([0, 1, 2, 0, 2, 3]));
    const heights = Arr.makeBy(
      4,
      (corner) => alone.vertices[corner * STRIDE + 1]
    );
    expect(Arr.every(heights, (y) => y === heights[0])).toBe(true);
    expect(heights[0]).toBeCloseTo(SEA_LEVEL - 0.06);
    const stroke = flatQuads(32, 1 / 2);
    expect(stroke.vertices[3]).not.toBeCloseTo(alone.vertices[3]);
  });

  it("stands the fishing float upright at its place, its tile's width wide and facing the camera", () => {
    const quad = standingQuad(5, [10, 8, 20], 0.5, 0);
    expect(quad).toHaveLength(4 * STRIDE);
    const corner = (index: number) =>
      Arr.take(Arr.drop(quad, index * STRIDE), 3);
    expect(corner(0)).toEqual([9.75, 8, 20]);
    expect(corner(1)).toEqual([10.25, 8, 20]);
    expect(corner(2)).toEqual([10.25, 8.5, 20]);
    expect(corner(3)).toEqual([9.75, 8.5, 20]);
  });
});
