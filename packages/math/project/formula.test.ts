import { formulaExpressionForComputation } from "@repo/math/project/formula";
import type { MathComputation } from "@repo/math/schema/work";
import { describe, expect, it } from "vitest";

describe("formulaExpressionForComputation", () => {
  it("shows one-variable solve results as equations", () => {
    const expression = formulaExpressionForComputation(
      solveComputation("[3]", "\\left[3\\right]")
    );

    expect(expression).toEqual({
      expression: "x = 3",
      latex: "x = 3",
    });
  });

  it("uses plain solution values when CAS LaTeX is not list-shaped", () => {
    const expression = formulaExpressionForComputation(
      solveComputation("[3]", "3")
    );

    expect(expression).toEqual({
      expression: "x = 3",
      latex: "x = 3",
    });
  });

  it("shows multiple solve results as a solution set", () => {
    const expression = formulaExpressionForComputation(
      solveComputation("[-1, 1]", "\\left[-1,1\\right]")
    );

    expect(expression).toEqual({
      expression: "x in {-1, 1}",
      latex: "x \\in \\left\\{-1, 1\\right\\}",
    });
  });

  it("shows solve-system item evidence instead of the original system", () => {
    const expression = formulaExpressionForComputation({
      ...solveComputation(),
      input: {
        expressions: ["x = 1", "y = 2"],
        kind: "math",
        operation: "solve",
        variables: ["x", "y"],
      },
      items: [
        {
          label: "solution",
          latex: "\\left\\{x: 1, y: 2\\right\\}",
          value: "{x: 1, y: 2}",
        },
      ],
      primary: {
        expression: "[x = 1, y = 2]",
        latex: "\\left[x = 1, y = 2\\right]",
      },
    });

    expect(expression).toEqual({
      expression: "{x: 1, y: 2}",
      latex: "\\left\\{x: 1, y: 2\\right\\}",
    });
  });

  it("uses system item values when item LaTeX is absent", () => {
    const expression = formulaExpressionForComputation({
      ...solveComputation(),
      input: {
        expressions: ["x = 1", "y = 2"],
        kind: "math",
        operation: "solve",
        variables: ["x", "y"],
      },
      items: [
        {
          label: "solution",
          value: "{x: 1, y: 2}",
        },
      ],
    });

    expect(expression).toEqual({
      expression: "{x: 1, y: 2}",
      latex: "{x: 1, y: 2}",
    });
  });

  it("shows item-only deterministic outcomes for non-solve operations", () => {
    const expression = formulaExpressionForComputation({
      ...solveComputation(),
      input: {
        expression: "1 / x",
        kind: "math",
        lower: "0",
        operation: "integrate",
        upper: "1",
        variable: "x",
      },
      items: [
        {
          label: "status",
          latex: "\\text{divergent}",
          value: "divergent",
        },
        {
          label: "singularity",
          latex: "x = 0",
          value: "x = 0",
        },
      ],
      kind: "integrate",
      operation: "integrate",
      primary: {
        expression: "Integral(1 / x, (x, 0, 1))",
        latex: "\\int_0^1 \\frac{1}{x}\\, dx",
      },
      secondary: undefined,
    });

    expect(expression).toEqual({
      expression: "divergent; x = 0",
      latex: "\\text{divergent}; x = 0",
    });
  });

  it("keeps ordinary computations on their CAS expression", () => {
    const expression = formulaExpressionForComputation({
      ...solveComputation("[3]", "\\left[3\\right]"),
      input: {
        expression: "2x + 3x",
        kind: "math",
        operation: "simplify",
      },
      operation: "simplify",
      primary: {
        expression: "2x + 3x",
        latex: "2x + 3x",
      },
      secondary: {
        expression: "5x",
        latex: "5x",
      },
    });

    expect(expression).toEqual({
      expression: "5x",
      latex: "5x",
    });
  });

  it("falls back when solve evidence cannot be turned into one equation", () => {
    const primaryOnly = formulaExpressionForComputation(solveComputation());
    const noVariable = formulaExpressionForComputation({
      ...solveComputation("[3]", "\\left[3\\right]"),
      input: {
        expression: "x + 2 = 5",
        kind: "math",
        operation: "solve",
        variables: [],
      },
    });
    const omittedVariable = formulaExpressionForComputation({
      ...solveComputation("[3]", "\\left[3\\right]"),
      input: {
        expression: "x + 2 = 5",
        kind: "math",
        operation: "solve",
      },
    });
    const emptyVariable = formulaExpressionForComputation({
      ...solveComputation("[3]", "\\left[3\\right]"),
      input: {
        expression: "x + 2 = 5",
        kind: "math",
        operation: "solve",
        variables: [""],
      },
    });
    const plainSecondary = formulaExpressionForComputation(
      solveComputation("3", "3")
    );
    const emptyList = formulaExpressionForComputation(
      solveComputation("[, ]", "\\left[, \\right]")
    );

    expect(primaryOnly).toEqual({
      expression: "x + 2 = 5",
      latex: "x + 2 = 5",
    });
    expect(noVariable.expression).toBe("[3]");
    expect(omittedVariable.expression).toBe("[3]");
    expect(emptyVariable.expression).toBe("[3]");
    expect(plainSecondary.expression).toBe("3");
    expect(emptyList.expression).toBe("[, ]");
  });
});

/** Builds a normalized solve computation fixture for formula projection tests. */
function solveComputation(
  expression?: string,
  latex?: string
): MathComputation {
  const computation: MathComputation = {
    conditions: [],
    input: {
      expression: "x + 2 = 5",
      kind: "math",
      operation: "solve",
      variables: ["x"],
    },
    items: [],
    kind: "solve",
    operation: "solve",
    primary: {
      expression: "x + 2 = 5",
      latex: "x + 2 = 5",
    },
    stepStatus: "partial",
    steps: [],
    status: "verified",
  };

  if (expression && latex) {
    return {
      ...computation,
      secondary: {
        expression,
        latex,
      },
    };
  }

  return computation;
}
