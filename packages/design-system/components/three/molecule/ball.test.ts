import { describe, expect, it } from "@effect/vitest";
import {
  atomFacets,
  facetsOf,
  seamProfile,
} from "@repo/design-system/components/three/molecule/ball";
import { Array as Arr, Option } from "effect";

describe("seamProfile", () => {
  it("runs from pole to pole on the unit sphere with a seam at the equator", () => {
    const profile = seamProfile(8);
    expect(profile).toHaveLength(11);
    expect(profile[0]?.[1]).toBeCloseTo(-1, 9);
    expect(Option.getOrUndefined(Arr.last(profile))?.[1]).toBeCloseTo(1, 9);
    const radii = Arr.map(profile, ([radius, height]) =>
      Math.hypot(radius, height)
    );
    expect(Math.min(...radii)).toBeCloseTo(0.988, 9);
    expect(Arr.filter(radii, (radius) => radius < 0.999)).toHaveLength(1);
  });

  it("raises an odd or tiny count of rings so a ring falls on the seam", () => {
    expect(seamProfile(7)).toEqual(seamProfile(8));
    expect(seamProfile(1)).toEqual(seamProfile(4));
  });
});

describe("facetsOf", () => {
  it("draws finer on stronger tiers", () => {
    expect(facetsOf("full").rings).toBeGreaterThan(facetsOf("light").rings);
    expect(facetsOf("light").sides).toBeGreaterThan(facetsOf("low").sides);
    expect(facetsOf("plain")).toEqual(facetsOf("low"));
  });
});

describe("atomFacets", () => {
  it("draws a small model as the tier asks and a crowd coarser than any tier", () => {
    expect(atomFacets("full", 500)).toEqual(facetsOf("full"));
    expect(atomFacets("full", 2000).sides).toBeLessThan(facetsOf("low").sides);
    expect(atomFacets("low", 2000)).toEqual(atomFacets("full", 2000));
  });
});
