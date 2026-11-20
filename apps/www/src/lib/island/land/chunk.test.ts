// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  CHUNK,
  chunkOf,
  indexOf,
  keyOf,
  LIFT_STEPS,
  PAINT,
  POINTS,
  paintOver,
  placeOf,
} from "@/lib/island/land/chunk";
import { pointOf } from "@/lib/island/land/relief";

const SEED = 4242;

describe("island/land/chunk", () => {
  it("names a chunk either way of the origin by one key and reads its place back", () => {
    expect(placeOf(keyOf(0, 0))).toEqual([0, 0]);
    expect(placeOf(keyOf(-3, 17))).toEqual([-3, 17]);
    expect(placeOf(keyOf(120, -4000))).toEqual([120, -4000]);
    expect(keyOf(-1, 0)).not.toBe(keyOf(0, -1));
  });

  it("finds a lattice point's place inside its chunk on both sides of zero", () => {
    expect(indexOf(0, 0)).toBe(0);
    expect(indexOf(CHUNK + 3, 2)).toBe(2 * CHUNK + 3);
    expect(indexOf(-1, -1)).toBe(POINTS - 1);
  });

  it("holds at every lattice point what the seed grows there", () => {
    const chunk = chunkOf(SEED, -2, 1, Option.none(), Option.none());
    const index = indexOf(5, 9);
    const point = pointOf(SEED, -2 * CHUNK + 5, CHUNK + 9);
    expect(chunk.heights[index]).toBeCloseTo(point.height, 5);
    expect(chunk.surfaces[index]).toBeCloseTo(point.surface, 5);
    expect(chunk.elevations[index]).toBeCloseTo(point.elevation, 4);
    expect(chunk.wets[index]).toBeCloseTo(point.wet, 4);
    expect(chunk.kinds[index * 4]).toBe(0);
    expect(chunk.kinds[index * 4 + 1]).toBe(Math.round(point.sand * 255));
  });

  it("lays the learner's lifts and paints over the seed's land", () => {
    const plain = chunkOf(SEED, 0, 0, Option.none(), Option.none());
    const lifts = new Int8Array(POINTS);
    const paints = new Uint8Array(POINTS);
    lifts[40] = 12;
    lifts[41] = -4;
    paints[40] = PAINT.path;
    paints[42] = PAINT.sand;
    const edited = chunkOf(SEED, 0, 0, Option.some(lifts), Option.some(paints));
    expect(edited.heights[40]).toBeCloseTo(
      plain.heights[40] + 12 / LIFT_STEPS,
      5
    );
    expect(edited.heights[41]).toBeCloseTo(
      plain.heights[41] - 4 / LIFT_STEPS,
      5
    );
    expect(edited.heights[43]).toBe(plain.heights[43]);
    expect(edited.kinds[40 * 4]).toBe(255);
    expect(edited.kinds[42 * 4 + 1]).toBe(255);
    expect(edited.kinds[43 * 4]).toBe(plain.kinds[43 * 4]);
  });

  it("paints one surface at a time, and digs a pond only where no water stands", () => {
    const chunk = {
      heights: new Float32Array([10, 10]),
      kinds: new Uint8Array(8),
      surfaces: new Float32Array([8, 11]),
    };
    paintOver(chunk, 0, PAINT.meadow);
    expect(Array.from(chunk.kinds.subarray(0, 4))).toEqual([0, 0, 255, 0]);
    paintOver(chunk, 0, PAINT.grass);
    expect(Array.from(chunk.kinds.subarray(0, 4))).toEqual([0, 0, 0, 0]);
    paintOver(chunk, 0, PAINT.pond);
    expect(chunk.heights[0]).toBeCloseTo(9.25, 5);
    expect(chunk.surfaces[0]).toBeCloseTo(9.88, 5);
    paintOver(chunk, 1, PAINT.pond);
    expect(chunk.heights[1]).toBe(10);
    expect(chunk.surfaces[1]).toBe(11);
  });
});
