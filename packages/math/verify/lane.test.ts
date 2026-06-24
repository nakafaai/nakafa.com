import type { MathResult } from "@repo/math/schema/result";
import { laneFromResult, laneFromStepStatus } from "@repo/math/verify/lane";
import { describe, expect, it } from "vitest";

describe("verification lanes", () => {
  it("maps CAS answer and step statuses into canonical trust lanes", () => {
    expect(laneFromResult(mathResult({ status: "contradicted" }))).toBe(
      "verified"
    );
    expect(laneFromResult(mathResult({ status: "inconclusive" }))).toBe(
      "speculative"
    );
    expect(laneFromStepStatus(mathResult({ stepStatus: "complete" }))).toBe(
      "derived"
    );
    expect(laneFromStepStatus(mathResult({ stepStatus: "unavailable" }))).toBe(
      "verified"
    );
  });
});

/** Builds a minimal CAS result with status overrides for lane tests. */
function mathResult(overrides: Partial<MathResult>): MathResult {
  return {
    conditions: [],
    input: {
      expression: "x",
      kind: "math",
      operation: "simplify",
    },
    items: [],
    kind: "simplify",
    operation: "simplify",
    primary: { expression: "x", latex: "x" },
    reason: "checked",
    stepStatus: "partial",
    steps: [],
    status: "verified",
    ...overrides,
  };
}
