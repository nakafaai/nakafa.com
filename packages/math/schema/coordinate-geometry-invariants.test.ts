import {
  ExactPoint3,
  ExactScalar,
  MathAst,
  type MathVariableName,
} from "@repo/math/schema/ast";
import {
  CanonicalFunctionSpec,
  FunctionDomain,
} from "@repo/math/schema/coordinate-primitives";
import {
  CoordinatePrimitiveInvariantError,
  findCoordinatePrimitiveIssue,
} from "@repo/math/schema/coordinate-validation";
import { describe, expect, it } from "vitest";

describe("coordinate geometry invariants", () => {
  it("rejects nonsortable domain lower bounds", () => {
    expect(
      readIssueMessage([
        {
          function: functionSpec("x", domain("x", "left", "1")),
          id: "bad-domain-min",
          kind: "function-surface",
        },
      ])
    ).toBe(
      "Coordinate primitive bad-domain-min domain x must use sortable numeric bounds."
    );
  });

  it("rejects nonsortable domain upper bounds", () => {
    expect(
      readIssueMessage([
        {
          function: functionSpec("x", domain("x", "0", "right")),
          id: "bad-domain-max",
          kind: "function-surface",
        },
      ])
    ).toBe(
      "Coordinate primitive bad-domain-max domain x must use sortable numeric bounds."
    );
  });

  it("rejects inverted function domains", () => {
    expect(
      readIssueMessage([
        {
          function: functionSpec("x", domain("x", "5", "-5")),
          id: "bad-domain-order",
          kind: "function-surface",
        },
      ])
    ).toBe(
      "Coordinate primitive bad-domain-order domain x must be increasing."
    );
  });

  it("rejects invalid sphere radii", () => {
    expect(
      readIssueMessage([
        {
          center: point("0", "0", "0"),
          id: "sphere-negative",
          kind: "sphere",
          radius: scalar("-1"),
        },
      ])
    ).toBe(
      "Coordinate primitive sphere-negative sphere radius must be positive."
    );

    expect(
      readIssueMessage([
        {
          center: point("0", "0", "0"),
          id: "sphere-symbolic",
          kind: "sphere",
          radius: scalar("r"),
        },
      ])
    ).toBe(
      "Coordinate primitive sphere-symbolic sphere radius must use a sortable numeric value."
    );
  });

  it("rejects cuboid bounds that are nonsortable or inverted", () => {
    expect(
      readIssueMessage([
        {
          id: "cuboid-bad-min",
          kind: "cuboid",
          max: point("1", "1", "1"),
          min: point("left", "0", "0"),
        },
      ])
    ).toBe(
      "Coordinate primitive cuboid-bad-min cuboid x-axis must use sortable numeric bounds."
    );

    expect(
      readIssueMessage([
        {
          id: "cuboid-bad-max",
          kind: "cuboid",
          max: point("1", "top", "1"),
          min: point("0", "0", "0"),
        },
      ])
    ).toBe(
      "Coordinate primitive cuboid-bad-max cuboid y-axis must use sortable numeric bounds."
    );

    expect(
      readIssueMessage([
        {
          id: "cuboid-inverted",
          kind: "cuboid",
          max: point("1", "1", "1"),
          min: point("0", "0", "2"),
        },
      ])
    ).toBe(
      "Coordinate primitive cuboid-inverted cuboid z-axis must be increasing."
    );
  });
});

function readIssueMessage(
  primitives: Parameters<typeof findCoordinatePrimitiveIssue>[0]
) {
  const issue = findCoordinatePrimitiveIssue(primitives);

  expect(issue).toBeInstanceOf(CoordinatePrimitiveInvariantError);
  return issue?.message;
}

function functionSpec(
  variable: MathVariableName,
  functionDomain: FunctionDomain
) {
  return CanonicalFunctionSpec.make({
    ast: variableAst(variable),
    domain: [functionDomain],
  });
}

function domain(variable: MathVariableName, min: string, max: string) {
  return FunctionDomain.make({
    closedMax: true,
    closedMin: true,
    max: scalar(max),
    min: scalar(min),
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

function point(x: string, y: string, z: string) {
  return ExactPoint3.make({
    x: scalar(x),
    y: scalar(y),
    z: scalar(z),
  });
}

function scalar(expression: string) {
  return ExactScalar.make({
    expression,
    latex: expression,
  });
}
