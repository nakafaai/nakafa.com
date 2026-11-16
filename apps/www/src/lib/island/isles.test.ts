// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { isleGround, islesMesh, islesOf } from "@/lib/island/isles";
import { STRIDE } from "@/lib/island/mesh";
import { SEA_LEVEL } from "@/lib/island/world";

const MIDDLE = SPAN / 2;

describe("island/isles", () => {
  it("rings the learner's island with six isles past the whale's round, none touching another", () => {
    for (const seed of [7, 11, 2026]) {
      const isles = islesOf(seed);
      expect(isles).toHaveLength(6);
      for (const isle of isles) {
        const away = Math.hypot(isle.x - MIDDLE, isle.z - MIDDLE);
        expect(away - isle.radius * 1.15).toBeGreaterThan(MIDDLE + 20);
      }
      for (const [a, b] of Arr.flatMap(isles, (a, i) =>
        Arr.map(Arr.drop(isles, i + 1), (b) => [a, b] as const)
      )) {
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(
          (a.radius + b.radius) * 1.15
        );
      }
    }
  });

  it("grows each isle's ground: a lake in a large one's middle, a beach at its edge, stone on a tall hill, sea beyond", () => {
    const large = { forest: true, peak: 5, radius: 14, x: 100.5, z: 40.5 };
    expect(isleGround(large, 7, 100, 40)).toEqual(
      Option.some({ block: idOf("sand"), top: SEA_LEVEL - 2 })
    );
    expect(isleGround(large, 7, 140, 40)).toEqual(Option.none());
    const tops = Arr.flatMap(
      Arr.makeBy(30, (dx) => dx + 86),
      (x) => Option.toArray(isleGround(large, 7, x, 46))
    );
    expect(Arr.some(tops, (ground) => ground.top === SEA_LEVEL - 1)).toBe(true);
    const small = { forest: false, peak: 5, radius: 6, x: 100.5, z: 40.5 };
    expect(
      Option.map(isleGround(small, 7, 100, 40), (ground) => ground.top)
    ).not.toEqual(Option.some(SEA_LEVEL - 2));
    const steep = { forest: false, peak: 40, radius: 6, x: 100.5, z: 40.5 };
    expect(
      Option.map(isleGround(steep, 7, 100, 40), (ground) => ground.block)
    ).toEqual(Option.some(idOf("stone")));
  });

  it("draws every isle as whole quads in the chunk layout, all outside the learner's own island", () => {
    const mesh = islesMesh(11);
    expect(mesh.vertices.length % (4 * STRIDE)).toBe(0);
    expect(mesh.indices).toHaveLength(
      (mesh.vertices.length / (4 * STRIDE)) * 6
    );
    for (let at = 0; at < mesh.vertices.length; at += STRIDE * 97) {
      const reach = Math.hypot(
        mesh.vertices[at] - MIDDLE,
        mesh.vertices[at + 2] - MIDDLE
      );
      expect(reach).toBeGreaterThan(MIDDLE + 10);
    }
  });

  it("grows trees on a wooded isle, taller than any of its hills", () => {
    const tallest = (seed: number) =>
      Math.max(
        ...Arr.map(
          Arr.chunksOf(Array.from(islesMesh(seed).vertices), STRIDE),
          (vertex) => vertex[1]
        )
      );
    // Grass grows below stone, which tops the tallest hills, so only a crown of leaves reaches this high.
    expect(
      Arr.some([1, 7, 42, 1009], (seed) => tallest(seed) > SEA_LEVEL + 7)
    ).toBe(true);
  });
});
