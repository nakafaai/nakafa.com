import { describe, expect, it } from "@effect/vitest";
import { parseFormulaRuns } from "@repo/design-system/components/contents/chemistry/formula";

describe("chemical formula typography runs", () => {
  it("parses Unicode subscripts into grouped sub runs", () => {
    expect(parseFormulaRuns("AgNO₃")).toEqual([
      { kind: "normal", text: "AgNO" },
      { kind: "sub", text: "3" },
    ]);
    expect(parseFormulaRuns("P₄O₁₀")).toEqual([
      { kind: "normal", text: "P" },
      { kind: "sub", text: "4" },
      { kind: "normal", text: "O" },
      { kind: "sub", text: "10" },
    ]);
    expect(parseFormulaRuns("CH₃COOH")).toEqual([
      { kind: "normal", text: "CH" },
      { kind: "sub", text: "3" },
      { kind: "normal", text: "COOH" },
    ]);
    expect(parseFormulaRuns("(C₅H₈)ₙ")).toEqual([
      { kind: "normal", text: "(C" },
      { kind: "sub", text: "5" },
      { kind: "normal", text: "H" },
      { kind: "sub", text: "8" },
      { kind: "normal", text: ")" },
      { kind: "sub", text: "n" },
    ]);
  });

  it("parses Unicode superscripts and ion charges into sup runs", () => {
    expect(parseFormulaRuns("dm³")).toEqual([
      { kind: "normal", text: "dm" },
      { kind: "sup", text: "3" },
    ]);
    expect(parseFormulaRuns("Ca²⁺")).toEqual([
      { kind: "normal", text: "Ca" },
      { kind: "sup", text: "2+" },
    ]);
    expect(parseFormulaRuns("Cl⁻")).toEqual([
      { kind: "normal", text: "Cl" },
      { kind: "sup", text: "-" },
    ]);
  });

  it("returns plain text runs unchanged and handles empty input", () => {
    expect(parseFormulaRuns("NaCl")).toEqual([
      { kind: "normal", text: "NaCl" },
    ]);
    expect(parseFormulaRuns("")).toEqual([]);
  });
});
