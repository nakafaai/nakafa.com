import { describe, expect, it } from "vitest";

import { getItemLabelKey, getItemValueKey } from "./labels";

describe("math item labels", () => {
  it("maps every CAS item label to a student-facing translation key", () => {
    expect(getItemLabelKey("approximation")).toBe("math-item-approximation");
    expect(getItemLabelKey("counterexample")).toBe("math-item-counterexample");
    expect(getItemLabelKey("domain")).toBe("math-item-domain");
    expect(getItemLabelKey("eigenvalue")).toBe("math-item-eigenvalue");
    expect(getItemLabelKey("eigenvector")).toBe("math-item-eigenvector");
    expect(getItemLabelKey("algebraic_multiplicity")).toBe(
      "math-item-algebraic-multiplicity"
    );
    expect(getItemLabelKey("geometric_multiplicity")).toBe(
      "math-item-geometric-multiplicity"
    );
    expect(getItemLabelKey("eigenbasis")).toBe("math-item-eigenbasis");
    expect(getItemLabelKey("diagonalizable")).toBe("math-item-diagonalizable");
    expect(getItemLabelKey("factor")).toBe("math-item-factor");
    expect(getItemLabelKey("mode")).toBe("math-item-mode");
    expect(getItemLabelKey("q1")).toBe("math-item-q1");
    expect(getItemLabelKey("q2")).toBe("math-item-q2");
    expect(getItemLabelKey("q3")).toBe("math-item-q3");
    expect(getItemLabelKey("root")).toBe("math-item-root");
    expect(getItemLabelKey("solution")).toBe("math-item-solution");
  });

  it("keeps unknown item labels on the generic result fallback", () => {
    expect(getItemLabelKey("future_item")).toBe("math-item-result");
  });

  it("localizes semantic boolean values without touching math values", () => {
    expect(getItemValueKey("diagonalizable", "true")).toBe("math-value-yes");
    expect(getItemValueKey("diagonalizable", "false")).toBe("math-value-no");
    expect(getItemValueKey("diagonalizable", "unknown")).toBeUndefined();
    expect(getItemValueKey("eigenvalue", "false")).toBeUndefined();
  });
});
