// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet } from "effect";
import {
  CLASS_HERD,
  CROWD_HERD,
  HOME_CAST,
  TOY_HERD,
} from "@/components/marketing/about/toys/herd";

describe("the animals of the home page", () => {
  it("gives the toys, the crowd and the class the slices of one cast, so no animal appears twice", () => {
    const parts = [...TOY_HERD, ...CROWD_HERD, ...CLASS_HERD];
    const names = Arr.map(parts, (mascot) => mascot.animal);

    expect(parts).toEqual(HOME_CAST);
    expect(HashSet.size(HashSet.fromIterable(names))).toBe(names.length);
  });
});
