import {
  ExactScalar,
  MathAst,
  type MathVariableName,
} from "@repo/math/schema/ast/schema";
import {
  CanonicalFunctionSpec,
  FunctionDomain,
} from "@repo/math/schema/coordinate/primitive";
import { findFunctionSurfaceOutputIssue } from "@repo/math/schema/coordinate/surface";
import { describe, expect, it } from "vitest";

describe("function surface output contract", () => {
  it("rejects output-axis ambiguity and surface-domain arity issues", () => {
    expect(
      findFunctionSurfaceOutputIssue(
        "surface-output-domain",
        "x",
        functionSpec(["x", "y"])
      )
    ).toBe(
      "Coordinate primitive surface-output-domain function surface output axis x must not be a domain variable."
    );
    expect(
      findFunctionSurfaceOutputIssue(
        "surface-param-domain",
        "y",
        functionSpec(["x", "t"])
      )
    ).toBe(
      "Coordinate primitive surface-param-domain function surface domain t must be a coordinate axis."
    );
    expect(
      findFunctionSurfaceOutputIssue(
        "scalar-surface-arity",
        "y",
        functionSpec(["x"])
      )
    ).toBe(
      "Coordinate primitive scalar-surface-arity must have exactly 2 function domain variables."
    );
  });
});

function functionSpec(domains: readonly MathVariableName[]) {
  return CanonicalFunctionSpec.make({
    ast: variableAst("x"),
    domain: domains.map(domain),
  });
}

function domain(variable: MathVariableName) {
  return FunctionDomain.make({
    closedMax: true,
    closedMin: true,
    max: scalar("1"),
    min: scalar("0"),
    variable,
  });
}

function variableAst(variable: MathVariableName) {
  return MathAst.make({
    canonical: variable,
    latex: variable,
    nodes: [{ id: variable, kind: "variable", name: variable }],
    root: variable,
  });
}

function scalar(expression: string) {
  return ExactScalar.make({ expression, latex: expression });
}
