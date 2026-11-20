// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, MutableHashMap, Option } from "effect";
import { CHUNK, indexOf, PAINT } from "@/lib/island/land/chunk";
import { setPaint } from "@/lib/island/land/edits";
import {
  chunkAt,
  coverAt,
  depthAt,
  elevationAt,
  flowAt,
  forgetBeyond,
  heightAt,
  landOf,
  normalAt,
  slopeAt,
  standAt,
  surfaceAt,
} from "@/lib/island/land/ground";
import { pointOf, SEA } from "@/lib/island/land/relief";

const SEED = 4242;

/** The first place of a grid about the origin that a test asks for. */
function placeWhere(
  test: (point: ReturnType<typeof pointOf>, x: number, z: number) => boolean
) {
  return Option.getOrThrow(
    Arr.findFirst(
      Arr.flatMap(Arr.range(-60, 60), (j) =>
        Arr.map(Arr.range(-60, 60), (i) => [i * 9, j * 9] as const)
      ),
      ([x, z]) => test(pointOf(SEED, x, z), x, z)
    )
  );
}

describe("island/land/ground", () => {
  it("makes a chunk once and reads the same one again", () => {
    const land = landOf(SEED);
    const chunk = chunkAt(land, 2, -1);
    expect(chunkAt(land, 2, -1)).toBe(chunk);
    expect(MutableHashMap.size(land.chunks)).toBe(1);
  });

  it("reads the ground at a lattice point as the seed grows it, and blends between points across a chunk's edge", () => {
    const land = landOf(SEED);
    expect(heightAt(land, 31, 40)).toBeCloseTo(pointOf(SEED, 31, 40).height, 5);
    const near = pointOf(SEED, CHUNK - 1, 3).height;
    const far = pointOf(SEED, CHUNK, 3).height;
    expect(heightAt(land, CHUNK - 0.5, 3)).toBeCloseTo((near + far) / 2, 5);
    expect(surfaceAt(land, -7, 12)).toBeCloseTo(
      pointOf(SEED, -7, 12).surface,
      5
    );
  });

  it("stands a walker on dry ground and floats a swimmer just under the water's face", () => {
    const land = landOf(SEED);
    const dry = placeWhere((point) => point.elevation > 3 && point.wet < -4);
    expect(depthAt(land, dry[0], dry[1])).toBeLessThan(0);
    expect(standAt(land, dry[0], dry[1])).toBe(heightAt(land, dry[0], dry[1]));
    const sea = placeWhere((point) => point.elevation < -20);
    expect(depthAt(land, sea[0], sea[1])).toBeGreaterThan(2);
    expect(standAt(land, sea[0], sea[1])).toBeCloseTo(SEA - 0.32, 5);
    // In the shallows the swimmer's feet touch the bed before the float would hold them.
    const shoal = placeWhere(
      (point) =>
        point.surface - point.height > 0.02 &&
        point.surface - point.height < 0.3
    );
    expect(standAt(land, shoal[0], shoal[1])).toBe(
      heightAt(land, shoal[0], shoal[1])
    );
  });

  it("measures how steep the ground is and which way it faces", () => {
    const land = landOf(SEED);
    const flat = placeWhere((point) => point.elevation < -30);
    expect(slopeAt(land, flat[0], flat[1])).toBeLessThan(0.4);
    const normal = normalAt(land, flat[0], flat[1]);
    expect(Math.hypot(normal[0], normal[1], normal[2])).toBeCloseTo(1, 6);
    expect(normal[1]).toBeGreaterThan(0.9);
    const steep = placeWhere((_, x, z) => slopeAt(land, x, z) > 1);
    expect(normalAt(land, steep[0], steep[1])[1]).toBeLessThan(0.75);
  });

  it("reads what covers the ground: a path, sand, a meadow, forest or grass", () => {
    const land = landOf(SEED);
    const at = (test: Parameters<typeof placeWhere>[0]) => {
      const [x, z] = placeWhere(test);
      return coverAt(land, x, z);
    };
    expect(at((point) => point.elevation < -5)).toBe("sand");
    expect(at((point) => point.meadow > 0.6 && point.sand < 0.4)).toBe(
      "meadow"
    );
    expect(
      at(
        (point) =>
          point.sand < 0.4 &&
          point.meadow < 0.4 &&
          point.forest * 0.6 + (point.moist - 0.35) * 1.3 > 0.7
      )
    ).toBe("forest");
    expect(
      at(
        (point) =>
          point.sand < 0.4 &&
          point.meadow < 0.4 &&
          point.forest * 0.6 + (point.moist - 0.35) * 1.3 < 0.4
      )
    ).toBe("grass");
    const [x, z] = placeWhere((point) => point.elevation > 3);
    setPaint(land, x, z, PAINT.path);
    expect(coverAt(land, x, z)).toBe("path");
  });

  it("reads the continent's elevation and a river's way at the nearest lattice point", () => {
    const land = landOf(SEED);
    expect(elevationAt(land, 12.4, -3.6)).toBeCloseTo(
      pointOf(SEED, 12, -4).elevation,
      4
    );
    const chunk = chunkAt(land, 0, 0);
    chunk.flows[indexOf(4, 6) * 2] = 127;
    chunk.flows[indexOf(4, 6) * 2 + 1] = -127;
    expect(flowAt(land, 4.2, 5.8)).toEqual([1, -1]);
  });

  it("forgets the chunks far from the learner and keeps the near ones", () => {
    const land = landOf(SEED);
    chunkAt(land, 0, 0);
    chunkAt(land, 1, 1);
    chunkAt(land, 9, 0);
    chunkAt(land, 0, -9);
    expect(forgetBeyond(land, 0, 0, 3)).toBe(2);
    expect(MutableHashMap.size(land.chunks)).toBe(2);
    expect(MutableHashMap.has(land.chunks, 0)).toBe(false);
  });
});
