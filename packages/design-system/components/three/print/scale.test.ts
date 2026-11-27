// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  digitsOf,
  graduate,
  shareAt,
} from "@repo/design-system/components/three/print/scale";
import { Array as Arr } from "effect";

/** Writes a number with a decimal comma, as a reader in Indonesia or Germany sees it. */
function comma(value: number, digits: number) {
  return value.toFixed(digits).replace(".", ",");
}

describe("the decimals a step needs", () => {
  it("writes a whole step without decimals and a fraction with its own", () => {
    expect(digitsOf(50)).toBe(0);
    expect(digitsOf(0.5)).toBe(1);
    expect(digitsOf(0.25)).toBe(2);
  });

  it("stops at six decimals for a step no decimal writes exactly", () => {
    expect(digitsOf(1 / 3)).toBe(6);
  });
});

describe("where a value stands on a scale", () => {
  it("runs from 0 at the first end to 1 at the last", () => {
    const scale = { from: 0, major: 50, to: 300 };
    expect(shareAt(scale, 0)).toBe(0);
    expect(shareAt(scale, 150)).toBe(0.5);
    expect(shareAt(scale, 300)).toBe(1);
  });

  it("holds a value past either end at that end", () => {
    const scale = { from: 0, major: 1, to: 3 };
    expect(shareAt(scale, -2)).toBe(0);
    expect(shareAt(scale, 9)).toBe(1);
  });

  it("reads a scale that runs downwards from its larger end", () => {
    expect(shareAt({ from: 60, major: 10, to: 0 }, 45)).toBe(0.25);
  });

  it("puts every value of a scale without a span at its start", () => {
    expect(shareAt({ from: 5, major: 1, to: 5 }, 5)).toBe(0);
  });
});

describe("the ticks of a scale", () => {
  it("numbers a dial from 0 to 300 kPa every 50 and ticks it every 10", () => {
    const ticks = graduate({ from: 0, major: 50, minor: 10, to: 300 }, comma);
    expect(ticks).toHaveLength(31);
    expect(
      Arr.map(
        Arr.filter(ticks, (tick) => tick.major),
        (tick) => tick.label
      )
    ).toEqual(["0", "50", "100", "150", "200", "250", "300"]);
    expect(ticks[7]).toEqual({
      label: "",
      major: false,
      share: 70 / 300,
      value: 70,
    });
  });

  it("writes every number with the decimals of its step, in the reader's locale", () => {
    const ticks = graduate({ from: 0, major: 0.5, to: 1.5 }, comma);
    expect(Arr.map(ticks, (tick) => tick.label)).toEqual([
      "0,0",
      "0,5",
      "1,0",
      "1,5",
    ]);
  });

  it("keeps steps of a quarter exact, with no stray digits", () => {
    const ticks = graduate({ from: 0, major: 1, minor: 0.25, to: 3 }, comma);
    expect(Arr.map(ticks, (tick) => tick.value)).toEqual([
      0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3,
    ]);
    expect(
      Arr.map(
        Arr.filter(ticks, (tick) => tick.major),
        (tick) => tick.value
      )
    ).toEqual([0, 1, 2, 3]);
  });

  it("ticks only the multiples of its step inside the scale", () => {
    const ticks = graduate({ from: 30, major: 100, minor: 50, to: 420 }, comma);
    expect(Arr.map(ticks, (tick) => tick.value)).toEqual([
      50, 100, 150, 200, 250, 300, 350, 400,
    ]);
    expect(ticks[0]?.share).toBeCloseTo(20 / 390);
  });

  it("lays a scale that runs downwards from 1 at its small end to 0 at its large", () => {
    const ticks = graduate({ from: 40, major: 10, to: 0 }, comma);
    expect(Arr.map(ticks, (tick) => [tick.value, tick.share])).toEqual([
      [0, 1],
      [10, 0.75],
      [20, 0.5],
      [30, 0.25],
      [40, 0],
    ]);
  });

  it("has no ticks without a step, or when no step falls inside it", () => {
    expect(graduate({ from: 0, major: 0, to: 10 }, comma)).toEqual([]);
    expect(graduate({ from: 1, major: 10, to: 9 }, comma)).toEqual([]);
  });
});
