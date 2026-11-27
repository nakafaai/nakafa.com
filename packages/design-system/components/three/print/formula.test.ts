// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  formulaRuns,
  setFormula,
} from "@repo/design-system/components/three/print/formula";

/** A face whose every character is half as wide as its size. */
function measure(text: string, size: number) {
  return text.length * size * 0.5;
}

describe("a formula as runs", () => {
  it("keeps plain text in one run on the baseline", () => {
    expect(formulaRuns("250 mL")).toEqual([{ level: 0, text: "250 mL" }]);
  });

  it("lowers subscripts and raises superscripts, each made a plain figure", () => {
    expect(formulaRuns("SO₄²⁻")).toEqual([
      { level: 0, text: "SO" },
      { level: -1, text: "4" },
      { level: 1, text: "2−" },
    ]);
    expect(formulaRuns("dm³")).toEqual([
      { level: 0, text: "dm" },
      { level: 1, text: "3" },
    ]);
  });

  it("joins neighbouring subscripts into one run", () => {
    expect(formulaRuns("C₁₂H₂₂O₁₁")).toEqual([
      { level: 0, text: "C" },
      { level: -1, text: "12" },
      { level: 0, text: "H" },
      { level: -1, text: "22" },
      { level: 0, text: "O" },
      { level: -1, text: "11" },
    ]);
  });

  it("has no runs for no text", () => {
    expect(formulaRuns("")).toEqual([]);
  });
});

describe("a formula set in a line", () => {
  it("sets scripts at seven tenths of the size, moved off the baseline as KaTeX moves them", () => {
    const set = setFormula("H₂O²", 10, measure);
    expect(set.runs).toEqual([
      { lift: 0, size: 10, text: "H", x: 0 },
      { lift: -1.5, size: 7, text: "2", x: 5 },
      { lift: 0, size: 10, text: "O", x: 8.5 },
      { lift: 3.63, size: 7, text: "2", x: 13.5 },
    ]);
    expect(set.width).toBe(17);
  });

  it("is as wide as its text when it has no scripts", () => {
    expect(setFormula("pH 7.0", 20, measure).width).toBe(60);
  });
});
