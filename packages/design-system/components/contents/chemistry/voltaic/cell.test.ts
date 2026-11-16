import { describe, expect, it } from "@effect/vitest";
import {
  cellOf,
  halfCell,
  massFor,
  oxidation,
  reduction,
} from "@repo/design-system/components/contents/chemistry/voltaic/cell";

describe("chemical cell", () => {
  it("makes magnesium the negative terminal against silver, at 3.18 V", () => {
    // SPM Kimia set 1, question 22.
    const cell = cellOf("silver", "magnesium");

    expect(cell.negative).toBe("magnesium");
    expect(cell.positive).toBe("silver");
    expect(cell.voltage).toBeCloseTo(3.18, 10);
    expect(cellOf("magnesium", "silver")).toEqual(cell);
  });

  it("writes each half-equation with the electrons the ion's charge needs", () => {
    expect(oxidation("magnesium")).toBe(
      "\\mathrm{Mg} \\rightarrow \\mathrm{Mg^{2+}} + 2e^-"
    );
    expect(reduction("silver")).toBe(
      "\\mathrm{Ag^+} + e^- \\rightarrow \\mathrm{Ag}"
    );
    expect(oxidation("silver")).toBe(
      "\\mathrm{Ag} \\rightarrow \\mathrm{Ag^+} + e^-"
    );
    expect(reduction("copper")).toBe(
      "\\mathrm{Cu^{2+}} + 2e^- \\rightarrow \\mathrm{Cu}"
    );
  });

  it("deposits 2.16 g of silver and dissolves 0.24 g of magnesium for 0.020 mol of electrons", () => {
    expect(massFor("silver", 0.02)).toBeCloseTo(2.16, 10);
    expect(massFor("magnesium", 0.02)).toBeCloseTo(0.24, 10);
    expect(halfCell("zinc").potential).toBe(-0.76);
    expect(cellOf("zinc", "copper").voltage).toBeCloseTo(1.1, 10);
    expect(halfCell("iron").molarMass).toBe(56);
  });
});
