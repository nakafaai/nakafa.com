// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  seededPicks,
  seededUniforms,
} from "@repo/design-system/components/contents/mathematics/chance";
import { Array as Arr } from "effect";

describe("seeded chance", () => {
  it("gives the same stream for the same seed, and values inside (0, 1)", () => {
    const first = seededUniforms(7, 1000);
    expect(seededUniforms(7, 1000)).toEqual(first);
    expect(Arr.every(first, (value) => value > 0 && value < 1)).toBe(true);
    expect(seededUniforms(8, 5)).not.toEqual(Arr.take(first, 5));
  });

  it("follows Park and Miller's minimal standard generator from seed 1", () => {
    expect(seededUniforms(1, 1)[0]).toBeCloseTo(48_271 / 2_147_483_647, 15);
  });

  it("still runs from a seed that is a multiple of the modulus", () => {
    expect(seededUniforms(2_147_483_647, 1)).toEqual(seededUniforms(1, 1));
  });

  it("picks every outcome about equally often", () => {
    const picks = seededPicks(42, 60_000, 6);
    const counts = Arr.map(
      Arr.range(0, 5),
      (face) => Arr.filter(picks, (pick) => pick === face).length
    );
    expect(Arr.every(counts, (count) => Math.abs(count - 10_000) < 400)).toBe(
      true
    );
  });
});
