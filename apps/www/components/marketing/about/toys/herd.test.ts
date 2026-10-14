// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet } from "effect";
import { homeHerd } from "@/components/marketing/about/toys/herd";

describe("the animals of the home page", () => {
  it("gives every part its own animals, so no animal appears twice", () => {
    const first = homeHerd(7, 0);
    const second = homeHerd(18, 7);
    const names = Arr.map([...first, ...second], (mascot) => mascot.animal);

    expect(first).toHaveLength(7);
    expect(second).toHaveLength(18);
    expect(HashSet.size(HashSet.fromIterable(names))).toBe(names.length);
  });

  it("gives the same animals for the same slice on every visit", () => {
    expect(homeHerd(5, 3)).toEqual(homeHerd(5, 3));
  });
});
