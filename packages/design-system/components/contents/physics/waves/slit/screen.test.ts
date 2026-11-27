import { describe, expect, it } from "@effect/vitest";
import {
  fringeStart,
  screenMarks,
  spacingOf,
} from "@repo/design-system/components/contents/physics/waves/slit/screen";
import { Array as Arr } from "effect";

const format = (value: number, digits: number) => value.toFixed(digits);
const layout = { dots: 0.5, scale: -0.1, span: -0.4, wide: 1.6 };
const inks = { count: "amber", scale: "black" };

describe("spacingOf", () => {
  it("spaces the fringes of 600 nm light 3.0 mm apart for slits 0.40 mm apart, 2.0 m away", () => {
    expect(
      spacingOf({ distance: 2, separation: 0.4, wavelength: 600 })
    ).toBeCloseTo(3, 9);
  });
});

describe("fringeStart", () => {
  it("starts at the centre without a span, and a whole number of fringes left of it with one", () => {
    expect(fringeStart(3, undefined)).toBe(0);
    expect(fringeStart(3, 12)).toBe(-6);
    expect(fringeStart(3, 9)).toBe(-3);
  });
});

describe("screenMarks", () => {
  it("prints only the millimetre scale without a span: 41 ticks and 5 numbers", () => {
    const marks = screenMarks({ spacing: 3 }, layout, inks, format);
    expect(Arr.filter(marks, (mark) => mark.kind === "line")).toHaveLength(41);
    expect(
      Arr.map(
        Arr.filter(marks, (mark) => mark.kind === "text"),
        (mark) => mark.text
      )
    ).toEqual(["-20", "-10", "0", "10", "20"]);
  });

  it("puts a dot over each of the 5 bright fringes in a 12 mm span, with P and Q at its ends", () => {
    const marks = screenMarks({ span: 12, spacing: 3 }, layout, inks, format);
    const dots = Arr.filter(marks, (mark) => mark.kind === "band");
    expect(dots).toHaveLength(5);
    expect(dots[0]?.at[0]).toBeCloseTo(-0.24, 9);
    expect(dots[4]?.at[0]).toBeCloseTo(0.24, 9);
    const letters = Arr.filter(
      marks,
      (mark) => mark.kind === "text" && mark.ink === "amber"
    );
    expect(Arr.map(letters, (mark) => mark.kind === "text" && mark.text)).toEqual(
      ["P", "Q"]
    );
    expect(letters[1]?.kind === "text" && letters[1].at[0]).toBeCloseTo(0.24, 9);
  });
});
