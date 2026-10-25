// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet } from "effect";
import {
  CLASS_HERD,
  CROWD_HERD,
  HOME_CAST,
  PRICING_CLASS_HERD,
  PRICING_SPARE_HERD,
  PRICING_TOY_HERD,
  SPARE_HERD,
  TOY_HERD,
} from "@/components/marketing/about/toys/herd";

describe("the animals of the home page", () => {
  it("gives the toys, the crowd, the class and the spare animals the slices of one cast, so no animal appears twice", () => {
    const parts = [...TOY_HERD, ...CROWD_HERD, ...CLASS_HERD, ...SPARE_HERD];
    const names = Arr.map(parts, (mascot) => mascot.animal);

    expect(parts).toEqual(HOME_CAST);
    expect(SPARE_HERD).toHaveLength(5);
    expect(HashSet.size(HashSet.fromIterable(names))).toBe(names.length);
  });
});

describe("the animals of the pricing page", () => {
  it("takes its toys, its class and its spare animals from its own cast, so no animal repeats on the page", () => {
    const parts = [
      ...PRICING_TOY_HERD,
      ...PRICING_CLASS_HERD,
      ...PRICING_SPARE_HERD,
    ];
    const names = Arr.map(parts, (mascot) => mascot.animal);

    expect(PRICING_TOY_HERD).toHaveLength(12);
    expect(PRICING_CLASS_HERD).toHaveLength(7);
    expect(PRICING_SPARE_HERD).toHaveLength(6);
    expect(HashSet.size(HashSet.fromIterable(names))).toBe(names.length);
  });
});
