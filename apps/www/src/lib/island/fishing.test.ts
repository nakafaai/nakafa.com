// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet, Result } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import {
  BITE,
  castOf,
  catchOf,
  dipOf,
  REACH,
  reelOf,
} from "@/lib/island/fishing";

describe("island/fishing", () => {
  it("casts a float onto water in reach, with a bite a few seconds later, and refuses water too far away", () => {
    const cast = castOf([10.5, 10.5], [12, 7, 10], 11, 0, 100);
    expect(Result.isSuccess(cast)).toBe(true);
    if (Result.isSuccess(cast)) {
      expect(cast.success.x).toBe(12.5);
      expect(cast.success.y).toBeCloseTo(7.95);
      expect(cast.success.bite).toBeGreaterThanOrEqual(101.5);
      expect(cast.success.bite).toBeLessThanOrEqual(104.5);
    }
    expect(castOf([0.5, 0.5], [REACH + 2, 7, 0], 11, 0, 100)).toEqual(
      Result.fail("far")
    );
  });

  it("reels in nothing before the bite, a fish while it bites, and nothing once it got away", () => {
    const cast = { at: 0, bite: 3, x: 1, y: 1, z: 1 };
    expect(reelOf(cast, 2)).toBe("early");
    expect(reelOf(cast, 3.5)).toBe("caught");
    expect(reelOf(cast, 3 + BITE + 0.1)).toBe("escaped");
    expect(dipOf(cast, 3.2)).toBeLessThan(-0.1);
    expect(Math.abs(dipOf(cast, 1))).toBeLessThanOrEqual(0.03);
  });

  it("catches only animals of the sea, different ones over many casts", () => {
    const catches = Arr.makeBy(40, (casts) => catchOf(7, casts));
    expect(Arr.every(catches, (index) => SPECIES[index].home === "sea")).toBe(
      true
    );
    expect(HashSet.size(HashSet.fromIterable(catches))).toBeGreaterThan(5);
  });
});
