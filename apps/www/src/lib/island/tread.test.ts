// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { Footing } from "@/lib/island/steps";
import { treadOf } from "@/lib/island/tread";

describe("island/tread", () => {
  it("gives every footing its recording: grass, sand, stone for gravel and rock, wood, and a splash in water", () => {
    const file = (footing: Footing) => treadOf(footing, 0).file;
    expect(Arr.map(Footing.literals, file)).toEqual([
      "step-grass",
      "step-sand",
      "step-grass",
      "step-stone",
      "step-wood",
      "step-stone",
      "splash",
    ]);
  });

  it("plays a forest's floor duller than grass, gravel lower than rock, and cuts a splash short", () => {
    const rates = Arr.map(
      ["soil", "grass", "gravel", "stone"] as const,
      (footing) =>
        Arr.reduce(
          Arr.makeBy(40, (count) => treadOf(footing, count).rate),
          0,
          (sum, rate) => sum + rate
        ) / 40
    );
    expect(rates[0]).toBeLessThan(rates[1] * 0.9);
    expect(rates[2]).toBeLessThan(rates[3] * 0.9);
    expect(treadOf("water", 3).cut).toBe(0.3);
    expect(treadOf("grass", 3).cut).toBe(0);
  });

  it("steps left and right in turn and never repeats one sound over a long walk", () => {
    expect(treadOf("grass", 4).pan).toBe(-0.18);
    expect(treadOf("grass", 5).pan).toBe(0.18);
    expect(treadOf("sand", 9)).toEqual(treadOf("sand", 9));
    expect(
      Arr.dedupe(Arr.makeBy(30, (count) => treadOf("wood", count).rate)).length
    ).toBeGreaterThan(25);
  });
});
