import { describe, expect, it } from "@effect/vitest";
import {
  packOf,
  reachOf,
} from "@repo/design-system/components/three/atom/nucleus";
import { Array as Arr } from "effect";

describe("packOf", () => {
  it("packs exactly the protons and neutrons asked for", () => {
    const calcium = packOf(20, 20);
    expect(calcium).toHaveLength(40);
    expect(
      Arr.filter(calcium, (nucleon) => nucleon.kind === "proton")
    ).toHaveLength(20);
    expect(packOf(1, 0)).toEqual([
      { at: expect.any(Array), kind: "proton" },
    ]);
    expect(packOf(0, 1)[0]?.kind).toBe("neutron");
  });

  it("stands every nucleon against its neighbours without overlap", () => {
    const sodium = packOf(11, 12);
    const gaps = Arr.flatMap(sodium, (first, index) =>
      Arr.map(Arr.drop(sodium, index + 1), (second) =>
        Math.hypot(
          first.at[0] - second.at[0],
          first.at[1] - second.at[1],
          first.at[2] - second.at[2]
        )
      )
    );
    expect(Math.min(...gaps)).toBeGreaterThan(1.85);
    expect(Math.min(...gaps)).toBeLessThan(2.15);
  });

  it("is a ball about the origin whose radius grows with the cube root of the mass", () => {
    const uranium = packOf(92, 146);
    const middle = Arr.reduce(uranium, 0, (sum, nucleon) => sum + nucleon.at[0]);
    expect(Math.abs(middle / uranium.length)).toBeLessThan(0.1);
    const ratio = (reachOf(uranium) - 1) / (reachOf(packOf(13, 14)) - 1);
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(2.5);
  });

  it("is the same each time and takes a count below zero as none", () => {
    expect(packOf(6, 6)).toEqual(packOf(6, 6));
    expect(packOf(-2, -1)).toEqual([]);
    expect(reachOf([])).toBe(1);
  });
});
