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
  status: "verified",
} satisfies MathResult;

describe("math data formatter", () => {
  it("formats loading data", () => {
    const data = {
      input,
      kind: "evaluate",
      status: "loading",
    } satisfies MathData;

    expect(formatMathData(data)).toBe("Math evidence is loading.");
  });

  it("formats error data", () => {
    const data = {
      error: "CAS is offline.",
      input,
      kind: "evaluate",
      status: "error",
    } satisfies MathData;

    expect(formatMathData(data)).toContain("- Error: CAS is offline.");
  });

  it("formats complete data with secondary value, items, and conditions", () => {
    const data = {
      input,
      kind: "evaluate",
      result: {
        ...result,
        conditions: ["x != 3"],
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

    expect(output).toContain("- Secondary: 42");
    expect(output).toContain("- counterexample: {x: 1}");
    expect(output).toContain("- Condition: x != 3");
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
      },
      status: "verified",
      summary: result.reason,
    } satisfies MathData;

    const output = formatMathData(data);

    expect(output).not.toContain("Secondary");
    expect(output).not.toContain("Condition");
  });
});
