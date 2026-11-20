// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet, Option, Result } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import {
  BITE,
  castOf,
  catchOf,
  dipOf,
  REACH,
  reelOf,
  WADE,
  waterAt,
} from "@/lib/island/fishing";
import { FACE, flood, plainOf } from "@/lib/island/test.plain";

/** A plain with a lake about (10, 0), a river about (10, 20), a sea about (10, 40) and a puddle about (10, -20). */
function watered() {
  const land = plainOf(1);
  for (const i of Arr.range(6, 14)) {
    for (const j of Arr.range(-4, 4)) {
      flood(land, i, j, 2);
      flood(land, i, j + 20, 2, "river");
      flood(land, i, j + 40, 2, "sea");
      flood(land, i, j - 20, WADE - 0.1);
    }
  }
  return land;
}

describe("island/fishing", () => {
  it("tells the sea, a river and a lake apart, and takes no float on dry ground or in a puddle", () => {
    const land = watered();
    expect(waterAt(land, 10, 0)).toEqual(Option.some("lake"));
    expect(waterAt(land, 10, 20)).toEqual(Option.some("river"));
    expect(waterAt(land, 10, 40)).toEqual(Option.some("sea"));
    expect(waterAt(land, 10, -20)).toEqual(Option.none());
    expect(waterAt(land, 25, 0)).toEqual(Option.none());
  });

  it("casts a float where the learner pressed on water in reach, with a bite a few seconds later", () => {
    const land = watered();
    const cast = Result.getOrThrow(castOf(land, [4, 0.5], [9.3, 1.2], 0, 100));
    expect([cast.x, cast.z, cast.water]).toEqual([9.3, 1.2, "lake"]);
    expect(cast.y).toBeCloseTo(FACE, 5);
    expect(cast.at).toBe(100);
    expect(cast.bite).toBeGreaterThanOrEqual(101.5);
    expect(cast.bite).toBeLessThanOrEqual(104.5);
    expect(
      Result.getOrThrow(castOf(land, [4, 20], [9, 20], 1, 100)).water
    ).toBe("river");
  });

  it("refuses a cast past the line's reach, onto dry ground, and into water too shallow for a float", () => {
    const land = watered();
    expect(castOf(land, [10 - REACH - 0.5, 0], [10, 0], 0, 100)).toEqual(
      Result.fail("far")
    );
    expect(
      Result.isSuccess(castOf(land, [10 - REACH + 0.5, 0], [10, 0], 0, 100))
    ).toBe(true);
    expect(castOf(land, [4, 0], [3, 0], 0, 100)).toEqual(Result.fail("far"));
    expect(castOf(land, [4, -20], [10, -20], 0, 100)).toEqual(
      Result.fail("far")
    );
  });

  it("reels in nothing before the bite, a fish while it bites, and nothing once it got away", () => {
    const cast = { at: 0, bite: 3, water: "sea", x: 1, y: 1, z: 1 } as const;
    expect(reelOf(cast, 2)).toBe("early");
    expect(reelOf(cast, 3.5)).toBe("caught");
    expect(reelOf(cast, 3 + BITE + 0.1)).toBe("escaped");
    expect(dipOf(cast, 3.2)).toBeLessThan(-0.1);
    expect(Math.abs(dipOf(cast, 1))).toBeLessThanOrEqual(0.03);
  });

  it("catches what lives in the water the float lay in, different ones over many casts", () => {
    const keysOf = (water: "lake" | "river" | "sea") =>
      Arr.map(
        Arr.makeBy(120, (casts) => catchOf(7, casts, water)),
        (index) => SPECIES[index]
      );
    const sea = keysOf("sea");
    const river = Arr.map(keysOf("river"), (species) => species.key);
    const lake = Arr.map(keysOf("lake"), (species) => species.key);
    expect(Arr.every(sea, (species) => species.home === "sea")).toBe(true);
    expect(HashSet.size(HashSet.fromIterable(sea))).toBeGreaterThan(8);
    expect(Arr.map(sea, (species) => species.key)).toContain("tuna");
    // A salmon runs a river and a koi keeps to still water; neither is caught at sea.
    expect(river).toContain("salmon");
    expect(river).not.toContain("koi");
    expect(river).not.toContain("tuna");
    expect(lake).toContain("koi");
    expect(lake).not.toContain("salmon");
    expect(Arr.map(sea, (species) => species.key)).not.toContain("koi");
    expect(Arr.map(sea, (species) => species.key)).not.toContain("salmon");
    expect(HashSet.size(HashSet.fromIterable(river))).toBeGreaterThan(4);
    expect(HashSet.size(HashSet.fromIterable(lake))).toBeGreaterThan(4);
  });
});
