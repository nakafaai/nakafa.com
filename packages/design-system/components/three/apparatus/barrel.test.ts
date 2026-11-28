// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  SYRINGE,
  scaleOf,
  travelOf,
} from "@repo/design-system/components/three/apparatus/barrel";
import { Array as Arr } from "effect";

const plain = (value: number, digits: number) => value.toFixed(digits);

describe("the plunger of a gas syringe", () => {
  it("stands at the zero mark when empty and moves the same distance for every millilitre", () => {
    expect(travelOf(0)).toBe(0);
    expect(travelOf(50)).toBeCloseTo(travelOf(100) / 2, 9);
    expect(travelOf(100)).toBeCloseTo(100e-6 / (Math.PI * 0.016 ** 2), 9);
  });

  it("is held between empty and the syringe's capacity", () => {
    expect(travelOf(-20)).toBe(0);
    expect(travelOf(250)).toBe(travelOf(SYRINGE.capacity));
  });

  it("stays inside the barrel when the syringe is full", () => {
    expect(SYRINGE.zero + travelOf(SYRINGE.capacity)).toBeLessThan(
      SYRINGE.mouth
    );
  });
});

describe("the scale of a gas syringe", () => {
  const scale = scaleOf("#1f3a8a", plain);

  it("runs as far as the plunger travels, with its middle half way along", () => {
    const run = travelOf(SYRINGE.capacity);
    expect(scale.sheet.height).toBeCloseTo(run + 0.012, 9);
    expect(scale.middle).toBeCloseTo(SYRINGE.zero + run / 2, 9);
  });

  it("marks every 5 mL and numbers every 20, from 0 to 100", () => {
    const lines = Arr.filter(scale.sheet.marks, (mark) => mark.kind === "line");
    const texts = Arr.filter(scale.sheet.marks, (mark) => mark.kind === "text");
    expect(lines).toHaveLength(21);
    expect(Arr.map(texts, (mark) => mark.text)).toEqual([
      "0",
      "20",
      "40",
      "60",
      "80",
      "100",
    ]);
  });
});
