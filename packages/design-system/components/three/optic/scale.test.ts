import { describe, expect, it } from "@effect/vitest";
import { railSheets } from "@repo/design-system/components/three/optic/scale";
import { Array as Arr } from "effect";

const format = (value: number, digits: number) => value.toFixed(digits);

describe("railSheets", () => {
  it("cuts a 42 cm scale into one sheet about each tenth centimetre, ending where the rail does", () => {
    const sheets = railSheets({ long: 4.2, tall: 0.1, unit: 0.1 }, "white", format);
    expect(Arr.map(sheets, (piece) => piece.sheet.width)).toEqual([
      0.5,
      1,
      1,
      1,
      expect.closeTo(0.7, 9),
    ]);
    expect(Arr.map(sheets, (piece) => piece.at)).toEqual([
      0.25,
      1,
      2,
      3,
      expect.closeTo(3.85, 9),
    ]);
    const total = Arr.reduce(sheets, 0, (sum, piece) => sum + piece.sheet.width);
    expect(total).toBeCloseTo(4.2, 9);
  });

  it("numbers every tenth centimetre in the middle of its sheet and leaves the zero bare", () => {
    const sheets = railSheets({ long: 4.2, tall: 0.1, unit: 0.1 }, "white", format);
    const numbers = Arr.map(sheets, (piece) =>
      Arr.filter(piece.sheet.marks, (mark) => mark.kind === "text")
    );
    expect(numbers[0]).toEqual([]);
    expect(numbers[2]).toHaveLength(1);
    expect(numbers[2]?.[0]).toMatchObject({ at: [0, expect.any(Number)], text: "20" });
    expect(numbers[4]?.[0]).toMatchObject({ text: "40" });
  });

  it("draws a tick at every centimetre and a longer one at every fifth", () => {
    const [, second] = railSheets({ long: 4.2, tall: 0.1, unit: 0.1 }, "white", format);
    const strokes = Arr.filter(second?.sheet.marks ?? [], (mark) => mark.kind === "line");
    expect(strokes).toHaveLength(11 + 3);
  });

  it("has no empty sheet when the rail ends halfway between two numbers", () => {
    const sheets = railSheets({ long: 0.5, tall: 0.1, unit: 0.1 }, "white", format);
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.sheet.width).toBe(0.5);
  });

  it("has no scale without a length or a unit", () => {
    expect(railSheets({ long: 0, tall: 0.1, unit: 0.1 }, "white", format)).toEqual([]);
    expect(railSheets({ long: 4, tall: 0.1, unit: 0 }, "white", format)).toEqual([]);
  });
});
