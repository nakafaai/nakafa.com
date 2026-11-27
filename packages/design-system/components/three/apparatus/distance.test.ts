import { describe, expect, it } from "@effect/vitest";
import {
  distanceSheet,
  scaleStep,
  spanSheet,
} from "@repo/design-system/components/three/apparatus/distance";
import { Array as Arr } from "effect";

describe("scaleStep", () => {
  it("numbers a slide of a few metres in whole metres", () => {
    expect(scaleStep(3.5)).toBe(1);
    expect(scaleStep(40)).toBe(10);
  });

  it("numbers a short slide in finer steps, down to a tenth of a metre", () => {
    expect(scaleStep(0.8)).toBe(0.2);
    expect(scaleStep(0.05)).toBe(0.1);
  });
});

describe("distanceSheet", () => {
  const format = (value: number, digits: number) => value.toFixed(digits);
  const sheet = distanceSheet(
    { long: 3.4, metre: 0.8, start: 0.2, tall: 0.1 },
    3.5,
    "black",
    format
  );

  it("starts at the block's mark and numbers every metre the plane has room for", () => {
    const numbers = Arr.filter(sheet.marks, (mark) => mark.kind === "text");
    expect(
      Arr.map(numbers, (mark) => mark.kind === "text" && mark.text)
    ).toStrictEqual(["0", "1", "2", "3", "4"]);
  });

  it("puts one metre of the slope one metre of the scale apart", () => {
    const ticks = Arr.filter(sheet.marks, (mark) => mark.kind === "line");
    expect(ticks).toHaveLength(21);
    expect(ticks[0]?.kind === "line" && ticks[0].from[0]).toBeCloseTo(-1.5, 12);
    expect(ticks[5]?.kind === "line" && ticks[5].from[0]).toBeCloseTo(-0.7, 12);
    expect(sheet.width).toBe(3.4);
    expect(sheet.height).toBe(0.1);
  });
});

describe("spanSheet", () => {
  it("draws the length with a tick across each end", () => {
    const sheet = spanSheet(2, "amber");
    expect(Arr.map(sheet.marks, (mark) => [mark.from, mark.to])).toStrictEqual([
      [
        [-1, 0],
        [1, 0],
      ],
      [
        [-1, -0.06],
        [-1, 0.06],
      ],
      [
        [1, -0.06],
        [1, 0.06],
      ],
    ]);
    expect(sheet.width).toBeCloseTo(2.014, 12);
    expect(sheet.height).toBe(0.12);
  });
});
