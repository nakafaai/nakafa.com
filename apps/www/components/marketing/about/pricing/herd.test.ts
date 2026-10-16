// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet } from "effect";
import {
  PRICING_CLASS_HERD,
  PRICING_TOY_HERD,
} from "@/components/marketing/about/pricing/herd";

describe("the animals of the pricing page", () => {
  it("gives the toys and the class slices of one cast, so no animal appears twice", () => {
    const parts = [...PRICING_TOY_HERD, ...PRICING_CLASS_HERD];
    const names = Arr.map(parts, (mascot) => mascot.animal);

    expect(HashSet.size(HashSet.fromIterable(names))).toBe(names.length);
    expect(PRICING_TOY_HERD).toHaveLength(6);
    expect(PRICING_CLASS_HERD).toHaveLength(7);
  });
});
