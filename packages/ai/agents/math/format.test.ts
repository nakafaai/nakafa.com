import { formatMathData } from "@repo/ai/agents/math/format";
import type { MathData, MathRequest, MathResult } from "@repo/math/schema";
import { describe, expect, it } from "vitest";

const input = {
  expression: "6 * 7",
  kind: "math",
  operation: "evaluate",
} satisfies MathRequest;

const result = {
  conditions: [],
  input,
  items: [],
  kind: "evaluate",
  operation: "evaluate",
  primary: {
    expression: "6 * 7",
    latex: "6 \\cdot 7",
  },
  reason: "Exact arithmetic was evaluated by SymPy.",
  secondary: {
    expression: "42",
    latex: "42",
  },
  stepStatus: "complete",
  steps: [
    {
      action: "evaluate",
      items: [],
      primary: {
        expression: "6 * 7",
        latex: "6 \\cdot 7",
      },
      relation: {
        expression: "equals",
        latex: "=",
      },
      secondary: {
        expression: "42",
        latex: "42",
      },
    },
  ],
  status: "verified",
} satisfies MathResult;

describe("math data formatter", () => {
  it("formats loading data", () => {
    const data = {
      input,
      kind: "evaluate",
      status: "loading",
    } satisfies MathData;

    expect(formatMathData(data)).toBe("Checked math work is loading.");
  });

  it("formats error data", () => {
    const data = {
      error: "Math service is offline.",
      input,
      kind: "evaluate",
      status: "error",
    } satisfies MathData;

    expect(formatMathData(data)).toContain("- Error: Math service is offline.");
  });

  it("formats complete data with steps, items, and conditions", () => {
    const data = {
      input,
      kind: "evaluate",
      result: {
        ...result,
        conditions: [
          {
            expression: "Ne(x, 3)",
            latex: "x \\neq 3",
          },
        ],
        items: [
          {
            label: "counterexample",
            latex: "\\left\\{ x : 1 \\right\\}",
            value: "{x: 1}",
          },
        ],
      },
      status: "verified",
      summary: result.reason,
    } satisfies MathData;

    const output = formatMathData(data);

    expect(output).not.toContain("- Secondary: 42");
    expect(output).not.toContain("Reason");
    expect(output).not.toContain("SymPy");
    expect(output).toContain("- Step (evaluate): 6 * 7 equals 42");
    expect(output).toContain("- counterexample: {x: 1}");
    expect(output).toContain("- Condition: Ne(x, 3)");
  });

  it("formats secondary value when no derivation steps are available", () => {
    const data = {
      input,
      kind: "evaluate",
      result: {
        ...result,
        steps: [],
      },
      status: "verified",
      summary: result.reason,
    } satisfies MathData;

    expect(formatMathData(data)).toContain("- Secondary: 42");
  });

  it("formats complete data without optional secondary details", () => {
    const data = {
      input,
      kind: "evaluate",
      result: {
        ...result,
        conditions: [],
        items: [],
        secondary: undefined,
        steps: [],
      },
      status: "verified",
      summary: result.reason,
    } satisfies MathData;

    const output = formatMathData(data);

    expect(output).not.toContain("Secondary");
    expect(output).not.toContain("Condition");
  });

  it("formats step data without optional relation or secondary", () => {
    const data = {
      input,
      kind: "evaluate",
      result: {
        ...result,
        steps: [
          {
            action: "domain",
            items: [],
            primary: {
              expression: "x",
              latex: "x",
            },
            relation: undefined,
            secondary: undefined,
          },
        ],
      },
      status: "verified",
      summary: result.reason,
    } satisfies MathData;

    const output = formatMathData(data);

    expect(output).toContain("- Step (domain): x");
  });
});
