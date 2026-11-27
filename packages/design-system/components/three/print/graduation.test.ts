// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  fillRise,
  graduationSheet,
} from "@repo/design-system/components/three/print/graduation";
import { Array as Arr, Option } from "effect";

const plain = (value: number, digits: number) => value.toFixed(digits);

describe("how far a vessel's level rises for each millilitre", () => {
  it("is the height of a millilitre in a cylinder of the vessel's bore", () => {
    // A bore of 45.4 mm radius holds 64.7 mL for each centimetre of height.
    expect(100 * fillRise(0.0454)).toBeCloseTo(0.015_44, 4);
  });

  it("is nothing for a vessel without a bore", () => {
    expect(fillRise(0)).toBe(0);
  });
});

describe("the scale fired on a vessel", () => {
  const sheet = graduationSheet(
    {
      caption: "500 mL",
      ink: "white",
      rise: fillRise(0.0454),
      scale: { from: 100, major: 100, minor: 50, to: 400 },
      size: 0.005,
    },
    plain
  );
  const lines = Arr.filter(sheet.marks, (mark) => mark.kind === "line");
  const texts = Arr.filter(sheet.marks, (mark) => mark.kind === "text");

  it("stands each mark at the height the vessel holds that volume, about its middle value", () => {
    const span = 300 * fillRise(0.0454);
    expect(lines[0]?.from[1]).toBeCloseTo(-span / 2);
    expect(lines[3]?.from[1]).toBeCloseTo(0);
    expect(lines[6]?.from[1]).toBeCloseTo(span / 2);
  });

  it("numbers the marks to their right and writes the caption above the top one", () => {
    expect(Arr.map(texts, (mark) => mark.text)).toEqual([
      "100",
      "200",
      "300",
      "400",
      "500 mL",
    ]);
    expect(texts[0]?.align).toBe("start");
    expect((texts[4]?.at[1] ?? 0) > (lines[6]?.from[1] ?? 0)).toBe(true);
  });

  it("keeps every mark inside the sheet", () => {
    for (const line of lines) {
      expect(Math.abs(line.to[0])).toBeLessThan(sheet.width / 2);
      expect(Math.abs(line.from[1])).toBeLessThan(sheet.height / 2);
    }
  });

  it("reads a scale that runs downwards from the top", () => {
    const down = graduationSheet(
      {
        caption: "mL",
        ink: "white",
        rise: 0.001,
        scale: { from: 50, major: 10, to: 0 },
        size: 0.004,
      },
      plain
    );
    const numbers = Arr.filter(down.marks, (mark) => mark.kind === "text");
    const zero = Arr.findFirst(numbers, (mark) => mark.text === "0");
    const fifty = Arr.findFirst(numbers, (mark) => mark.text === "50");
    expect(Option.map(fifty, (mark) => mark.at[1] > 0)).toEqual(
      Option.some(true)
    );
    expect(Option.map(zero, (mark) => mark.at[1] < 0)).toEqual(
      Option.some(true)
    );
    expect(Option.map(fifty, (mark) => mark.align)).toEqual(
      Option.some("start")
    );
  });
});
