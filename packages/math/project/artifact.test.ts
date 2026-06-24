import { projectArtifacts } from "@repo/math/project/artifact";
import type { MathResult } from "@repo/math/schema/result";
import { MathWork } from "@repo/math/schema/work";
import { describe, expect, it } from "vitest";

describe("projectArtifacts", () => {
  it("projects formula-only artifacts for non-visual results", () => {
    const artifacts = projectArtifacts({
      lane: "verified",
      result: mathResult("simplify"),
      steps: [],
      work: mathWork("simplify"),
    });

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.titleKey).toBe("math-work-formula-title");
  });

  it("projects coordinate circle visual intent with semantic copy keys", () => {
    const artifacts = projectArtifacts({
      lane: "verified",
      result: { ...mathResult("circle"), secondary: undefined },
      steps: [],
      work: mathWork("circle"),
    });
    const visual = artifacts.find(
      (artifact) => artifact.kind === "visual-intent"
    );

    expect(visual?.manifest.kind).toBe("visual-intent");
    if (visual?.manifest.kind !== "visual-intent") {
      return;
    }

    expect(visual.manifest.visualIntent).toMatchObject({
      descriptionKey: "math-visual-coordinate-circle-description",
      expressions: [{ expression: "x", latex: "x" }],
      kind: "coordinate-circle",
    });
  });
});

/** Builds a minimal MathWork fixture for artifact projection tests. */
function mathWork(operation: MathResult["operation"]) {
  return MathWork.make({
    assumptions: [],
    computations: [],
    input: {
      givens: [],
      kind: "prompt",
      locale: "en",
      objective: "Check",
      requirements: [],
      text: operation,
    },
    limitations: [],
    plannedRequest: {
      expression: "x",
      kind: "math",
      operation,
    },
    primaryResult: { expression: "x", latex: "x" },
    status: "ready",
    verification: {
      engine: "sympy",
      lane: "verified",
      reasonKey: "math-verification-verified",
      source: `cas.${operation}`,
      values: [],
    },
    workId: `math:${operation}:test`,
  });
}

/** Builds a minimal CAS result fixture for artifact projection tests. */
function mathResult(operation: MathResult["operation"]): MathResult {
  return {
    conditions: [],
    input: {
      expression: "x",
      kind: "math",
      operation,
    },
    items: [],
    kind: operation,
    operation,
    primary: { expression: "x", latex: "x" },
    reason: "checked",
    secondary: { expression: "x", latex: "x" },
    stepStatus: "complete",
    steps: [],
    status: "verified",
  };
}
