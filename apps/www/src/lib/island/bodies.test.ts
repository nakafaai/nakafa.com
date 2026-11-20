// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { animalBodies, BODY_STRIDE, joined } from "@/lib/island/bodies";
import { modelKey } from "@/lib/island/models/kinds";
import {
  dwellerAt,
  flood,
  GROUND,
  plainOf,
  speciesOf,
} from "@/lib/island/test.world";

describe("island/bodies", () => {
  it("draws each animal on its ground or afloat, facing where it goes and bobbing only while it walks", () => {
    const land = plainOf(1);
    flood(land, 6, 6, 2, "lake");
    const duck = speciesOf("duck");
    const walking = { ...dwellerAt("hen", 1, 1), tx: 1, tz: 5 };
    const resting = { ...walking, rest: 1, x: 3 };
    const standing = dwellerAt("hen", 2, 2);
    const bodies = animalBodies(land, [
      walking,
      resting,
      standing,
      dwellerAt(duck, 6, 6),
    ]);
    expect(Arr.map(bodies, ([model]) => modelKey(model))).toEqual([
      `species-${duck}`,
      "body-hen",
    ]);
    const hens = Arr.chunksOf(Arr.fromIterable(bodies[1][1]), BODY_STRIDE);
    expect(hens).toHaveLength(3);
    expect(hens[0]).toEqual([1, GROUND, 1, 0, Math.fround(0.06), 0]);
    // At rest it still faces its goal, and does not bob.
    expect(hens[1][4]).toBe(0);
    expect(hens[1][3]).toBeCloseTo(Math.atan2(-2, 4), 5);
    // With nowhere to go it keeps a heading of its own.
    expect(hens[2][3]).toBeCloseTo((2 * 7.3 + 2 * 3.1) % (2 * Math.PI), 5);
    expect(hens[2][4]).toBe(0);
    // A duck floats a little under the water's face.
    expect(bodies[0][1][1]).toBeCloseTo(GROUND - 0.32, 5);
  });

  it("joins the runs of a model that comes more than once, and passes a single run through untouched", () => {
    const once = Float32Array.of(1, 2, 3, 4, 5, 6);
    const first = Float32Array.of(1, 1, 1, 1, 1, 1);
    const second = Float32Array.of(2, 2, 2, 2, 2, 2);
    const bodies = joined([
      [{ _tag: "species", index: 4 }, first],
      [{ _tag: "body", kind: "whale" }, once],
      [{ _tag: "species", index: 4 }, second],
    ]);
    expect(Arr.map(bodies, ([model]) => modelKey(model))).toEqual([
      "species-4",
      "body-whale",
    ]);
    expect(Arr.fromIterable(bodies[0][1])).toEqual([
      1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2,
    ]);
    expect(bodies[1][1]).toBe(once);
  });
});
