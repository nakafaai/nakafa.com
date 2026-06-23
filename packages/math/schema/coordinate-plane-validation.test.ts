import {
  ExactPoint3,
  ExactScalar,
  MathAst,
  type MathAstNode,
  type MathVariableName,
} from "@repo/math/schema/ast";
import { findPlaneEquationConsistencyIssue } from "@repo/math/schema/coordinate-plane-validation";
import {
  CanonicalFunctionSpec,
  FunctionDomain,
} from "@repo/math/schema/coordinate-primitives";
import { describe, expect, it } from "vitest";

describe("coordinate plane equation validation", () => {
  it("accepts equivalent linear implicit equations", () => {
    const normal = point("0", "0", "1");
    const zTwo = point("0", "0", "2");

    expect(
      readIssue(variableAst("z"), normal, point("0", "0", "0"))
    ).toBeUndefined();
    expect(readIssue(zMinusTwoAst(), normal, zTwo)).toBeUndefined();
    expect(readIssue(twoTimesZMinusFourAst(), normal, zTwo)).toBeUndefined();
    expect(readIssue(zTimesTwoMinusFourAst(), normal, zTwo)).toBeUndefined();
    expect(readIssue(zDividedByTwoMinusOneAst(), normal, zTwo)).toBeUndefined();
    expect(readIssue(negativeZPlusTwoAst(), normal, zTwo)).toBeUndefined();
    expect(
      readIssue(zPlusZAst(), normal, point("0", "0", "0"))
    ).toBeUndefined();
    expect(
      readIssue(variableAst("x"), point("1", "0", "0"), point("0", "0", "0"))
    ).toBeUndefined();
    expect(
      readIssue(yMinusThreeAst(), point("0", "1", "0"), point("0", "3", "0"))
    ).toBeUndefined();
  });

  it("rejects unsupported or invalid plane equation graphs", () => {
    const normal = point("0", "0", "1");
    const origin = point("0", "0", "0");

    const invalidAsts = [
      multiplyVariablesAst(),
      zDividedByZeroAst(),
      sqrtZAst(),
      variableAst("t"),
      missingRootAst(),
      missingChildAst(),
      cyclicAst(),
      literalAst("left"),
      zPowerTwoAst(),
    ];

    for (const ast of invalidAsts) {
      expect(readIssue(ast, normal, origin)).toBe(
        "Coordinate primitive plane plane equation must be a linear implicit expression."
      );
    }
  });

  it("rejects nonsortable geometry and inconsistent equations", () => {
    expect(
      readIssue(variableAst("z"), point("0", "0", "1"), point("0", "0", "far"))
    ).toBe(
      "Coordinate primitive plane plane geometry must use sortable numeric values."
    );

    expect(
      readIssue(variableAst("z"), point("0", "0", "1"), point("0", "0", "1"))
    ).toBe(
      "Coordinate primitive plane plane equation is inconsistent with point and normal."
    );

    expect(
      readIssue(variableAst("x"), point("0", "0", "1"), point("0", "0", "0"))
    ).toBe(
      "Coordinate primitive plane plane equation is inconsistent with point and normal."
    );

    expect(
      readIssue(zPlusTinyXAst(), point("0", "0", "1"), point("0", "0", "0"))
    ).toBe(
      "Coordinate primitive plane plane equation is inconsistent with point and normal."
    );

    expect(
      readIssue(literalAst("0"), point("0", "0", "1"), point("0", "0", "0"))
    ).toBe(
      "Coordinate primitive plane plane equation is inconsistent with point and normal."
    );

    expect(
      readIssue(literalAst("0"), point("0", "0", "0"), point("0", "0", "0"))
    ).toBe(
      "Coordinate primitive plane plane equation is inconsistent with point and normal."
    );

    expect(
      readIssue(variableAst("z"), point("0", "0", "0"), point("0", "0", "0"))
    ).toBe(
      "Coordinate primitive plane plane equation is inconsistent with point and normal."
    );
  });
});

function readIssue(ast: MathAst, normal: ExactPoint3, point: ExactPoint3) {
  return findPlaneEquationConsistencyIssue(
    "plane",
    CanonicalFunctionSpec.make({
      ast,
      domain: [domain("z")],
    }),
    normal,
    point
  );
}

function zMinusTwoAst() {
  return makeAst("z - 2", [
    variableNode("z"),
    literalNode("2"),
    binaryNode("root", "z", "subtract", "literal-2"),
  ]);
}

function twoTimesZMinusFourAst() {
  return makeAst("2z - 4", [
    literalNode("2"),
    variableNode("z"),
    binaryNode("two-z", "literal-2", "multiply", "z"),
    literalNode("4"),
    binaryNode("root", "two-z", "subtract", "literal-4"),
  ]);
}

function zTimesTwoMinusFourAst() {
  return makeAst("z2 - 4", [
    variableNode("z"),
    literalNode("2"),
    binaryNode("z-two", "z", "multiply", "literal-2"),
    literalNode("4"),
    binaryNode("root", "z-two", "subtract", "literal-4"),
  ]);
}

function zDividedByTwoMinusOneAst() {
  return makeAst("z / 2 - 1", [
    variableNode("z"),
    literalNode("2"),
    binaryNode("half-z", "z", "divide", "literal-2"),
    literalNode("1"),
    binaryNode("root", "half-z", "subtract", "literal-1"),
  ]);
}

function negativeZPlusTwoAst() {
  return makeAst("-z + 2", [
    variableNode("z"),
    unaryNode("negative-z", "z", "negate"),
    literalNode("2"),
    binaryNode("root", "negative-z", "add", "literal-2"),
  ]);
}

function yMinusThreeAst() {
  return makeAst("y - 3", [
    variableNode("y"),
    literalNode("3"),
    binaryNode("root", "y", "subtract", "literal-3"),
  ]);
}

function zPlusZAst() {
  return makeAst("z + z", [
    variableNode("z"),
    binaryNode("root", "z", "add", "z"),
  ]);
}

function zPlusTinyXAst() {
  return makeAst("z + 1e-10*x", [
    variableNode("z"),
    literalNode("1e-10"),
    variableNode("x"),
    binaryNode("tiny-x", "literal-1e-10", "multiply", "x"),
    binaryNode("root", "z", "add", "tiny-x"),
  ]);
}

function multiplyVariablesAst() {
  return makeAst("x * y", [
    variableNode("x"),
    variableNode("y"),
    binaryNode("root", "x", "multiply", "y"),
  ]);
}

function zDividedByZeroAst() {
  return makeAst("z / 0", [
    variableNode("z"),
    literalNode("0"),
    binaryNode("root", "z", "divide", "literal-0"),
  ]);
}

function sqrtZAst() {
  return makeAst("sqrt(z)", [
    variableNode("z"),
    unaryNode("root", "z", "sqrt"),
  ]);
}

function zPowerTwoAst() {
  return makeAst("z^2", [
    variableNode("z"),
    literalNode("2"),
    binaryNode("root", "z", "power", "literal-2"),
  ]);
}

function missingRootAst() {
  return MathAst.make({
    canonical: "z",
    latex: "z",
    nodes: [variableNode("z")],
    root: "missing",
  });
}

function missingChildAst() {
  return makeAst("z + 1", [
    variableNode("z"),
    binaryNode("root", "z", "add", "missing"),
  ]);
}

function cyclicAst() {
  return MathAst.make({
    canonical: "-z",
    latex: "-z",
    nodes: [unaryNode("root", "root", "negate")],
    root: "root",
  });
}

function variableAst(variable: MathVariableName) {
  return makeAst(variable, [variableNode(variable)], variable);
}

function literalAst(expression: string) {
  return makeAst(
    expression,
    [literalNode(expression)],
    `literal-${expression}`
  );
}

function makeAst(
  canonical: string,
  nodes: readonly MathAstNode[],
  root = "root"
) {
  return MathAst.make({
    canonical,
    latex: canonical,
    nodes: [...nodes],
    root,
  });
}

function binaryNode(
  id: string,
  left: string,
  operator: Extract<MathAstNode, { kind: "binary" }>["operator"],
  right: string
): MathAstNode {
  return { id, kind: "binary", left, operator, right };
}

function unaryNode(
  id: string,
  operand: string,
  operator: Extract<MathAstNode, { kind: "unary" }>["operator"]
): MathAstNode {
  return { id, kind: "unary", operand, operator };
}

function variableNode(name: MathVariableName): MathAstNode {
  return { id: name, kind: "variable", name };
}

function literalNode(expression: string): MathAstNode {
  return {
    id: `literal-${expression}`,
    kind: "literal",
    value: scalar(expression),
  };
}

function domain(variable: MathVariableName) {
  return FunctionDomain.make({
    closedMax: true,
    closedMin: true,
    max: scalar("5"),
    min: scalar("-5"),
    variable,
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
