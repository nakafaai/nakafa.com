import {
  ExactPoint3,
  ExactScalar,
  MathAst,
  type MathAstNode,
  type MathVariableName,
} from "@repo/math/schema/ast/schema";
import { findPlaneEquationConsistencyIssue } from "@repo/math/schema/coordinate/plane";
import {
  CanonicalFunctionSpec,
  FunctionDomain,
} from "@repo/math/schema/coordinate/primitive";
import { describe, expect, it } from "vitest";

describe("coordinate plane equation validation", () => {
  it("accepts equivalent linear implicit equations", () => {
    const cases = [
      validCase(variableAst("z"), point("0", "0", "1"), point("0", "0", "0")),
      validCase(
        expr("z - 2", [
          v("z"),
          lit("2"),
          b("root", "z", "subtract", "literal-2"),
        ]),
        point("0", "0", "1"),
        point("0", "0", "2")
      ),
      validCase(
        expr("z*2 - 4", [
          v("z"),
          lit("2"),
          b("two-z", "z", "multiply", "literal-2"),
          lit("4"),
          b("root", "two-z", "subtract", "literal-4"),
        ]),
        point("0", "0", "1"),
        point("0", "0", "2")
      ),
      validCase(
        expr("z / 2 - 1", [
          v("z"),
          lit("2"),
          b("half-z", "z", "divide", "literal-2"),
          lit("1"),
          b("root", "half-z", "subtract", "literal-1"),
        ]),
        point("0", "0", "1"),
        point("0", "0", "2")
      ),
      validCase(
        expr("-z + 2", [
          v("z"),
          u("negative-z", "z", "negate"),
          lit("2"),
          b("root", "negative-z", "add", "literal-2"),
        ]),
        point("0", "0", "1"),
        point("0", "0", "2")
      ),
      validCase(variableAst("x"), point("1", "0", "0"), point("0", "0", "0")),
      validCase(
        expr("y - 3", [
          v("y"),
          lit("3"),
          b("root", "y", "subtract", "literal-3"),
        ]),
        point("0", "1", "0"),
        point("0", "3", "0")
      ),
      validCase(
        expr("z + z", [v("z"), b("root", "z", "add", "z")]),
        point("0", "0", "1"),
        point("0", "0", "0")
      ),
    ];

    for (const { ast, normal, planePoint } of cases) {
      expect(readIssue(ast, normal, planePoint)).toBeUndefined();
    }
  });

  it("rejects unsupported or unsafe plane equation graphs", () => {
    const normal = point("0", "0", "1");
    const origin = point("0", "0", "0");
    const invalidAsts = [
      expr("x * y", [v("x"), v("y"), b("root", "x", "multiply", "y")]),
      expr("z / 0", [v("z"), lit("0"), b("root", "z", "divide", "literal-0")]),
      expr("sqrt(z)", [v("z"), u("root", "z", "sqrt")]),
      variableAst("t"),
      MathAst.make({
        canonical: "z",
        latex: "z",
        nodes: [v("z")],
        root: "missing",
      }),
      expr("z + 1", [v("z"), b("root", "z", "add", "missing")]),
      MathAst.make({
        canonical: "-z",
        latex: "-z",
        nodes: [u("root", "root", "negate")],
        root: "root",
      }),
      expr("left", [lit("left")], "literal-left"),
      expr("z^2", [v("z"), lit("2"), b("root", "z", "power", "literal-2")]),
      expr("z + tiny*x", [
        v("z"),
        lit("1e-200"),
        v("x"),
        b("tiny-x", "literal-1e-200", "multiply", "x"),
        b("underflowed-x", "literal-1e-200", "multiply", "tiny-x"),
        b("root", "z", "add", "underflowed-x"),
      ]),
      expr("z + huge*x", [
        v("z"),
        lit("1e308"),
        v("x"),
        b("large-x", "literal-1e308", "multiply", "x"),
        b("overflowed-x", "literal-1e308", "multiply", "large-x"),
        b("root", "z", "add", "overflowed-x"),
      ]),
      expr("z / 1e-309", [
        v("z"),
        lit("1e-309"),
        b("root", "z", "divide", "literal-1e-309"),
      ]),
      expr("z - huge-sum", [
        v("z"),
        lit("1e308"),
        v("x"),
        b("large-x", "literal-1e308", "multiply", "x"),
        b("larger-x", "large-x", "add", "large-x"),
        b("root", "z", "subtract", "larger-x"),
      ]),
    ];

    for (const ast of invalidAsts) {
      expect(readIssue(ast, normal, origin)).toBe(
        "Coordinate primitive plane plane equation must be a linear implicit expression."
      );
    }
  });

  it("rejects nonsortable geometry and inconsistent equations", () => {
    const cases = [
      {
        ast: variableAst("z"),
        expected:
          "Coordinate primitive plane plane geometry must use sortable numeric values.",
        normal: point("0", "0", "1"),
        point: point("0", "0", "far"),
      },
      {
        ast: variableAst("x"),
        expected:
          "Coordinate primitive plane plane geometry must use sortable numeric values.",
        normal: point("1e-200", "0", "0"),
        point: point("1e-200", "0", "0"),
      },
      {
        ast: variableAst("x"),
        expected:
          "Coordinate primitive plane plane geometry must use sortable numeric values.",
        normal: point("1e308", "1e308", "0"),
        point: point("1", "1", "0"),
      },
      {
        ast: variableAst("z"),
        normal: point("0", "0", "1"),
        point: point("0", "0", "1"),
      },
      {
        ast: variableAst("x"),
        normal: point("0", "0", "1"),
        point: point("0", "0", "0"),
      },
      {
        ast: variableAst("x"),
        normal: point("1", "1e-10", "0"),
        point: point("0", "0", "0"),
      },
      {
        ast: variableAst("x"),
        normal: point("1e-320", "1", "0"),
        point: point("0", "0", "0"),
      },
      {
        ast: expr("1e154*x", [
          lit("1e154"),
          v("x"),
          b("root", "literal-1e154", "multiply", "x"),
        ]),
        normal: point("1e-154", "10", "0"),
        point: point("0", "0", "0"),
      },
      {
        ast: expr("z + 1e-10*x", [
          v("z"),
          lit("1e-10"),
          v("x"),
          b("tiny-x", "literal-1e-10", "multiply", "x"),
          b("root", "z", "add", "tiny-x"),
        ]),
        normal: point("0", "0", "1"),
        point: point("0", "0", "0"),
      },
      {
        ast: expr("0", [lit("0")], "literal-0"),
        normal: point("0", "0", "1"),
        point: point("0", "0", "0"),
      },
      {
        ast: variableAst("z"),
        normal: point("0", "0", "0"),
        point: point("0", "0", "0"),
      },
    ];

    for (const testCase of cases) {
      expect(readIssue(testCase.ast, testCase.normal, testCase.point)).toBe(
        testCase.expected ??
          "Coordinate primitive plane plane equation is inconsistent with point and normal."
      );
    }
  });
});

function readIssue(ast: MathAst, normal: ExactPoint3, point: ExactPoint3) {
  return findPlaneEquationConsistencyIssue(
    "plane",
    CanonicalFunctionSpec.make({ ast, domain: [domain("z")] }),
    normal,
    point
  );
}

function validCase(ast: MathAst, normal: ExactPoint3, planePoint: ExactPoint3) {
  return { ast, normal, planePoint };
}

function expr(canonical: string, nodes: readonly MathAstNode[], root = "root") {
  return MathAst.make({ canonical, latex: canonical, nodes: [...nodes], root });
}

function b(
  id: string,
  left: string,
  operator: Extract<MathAstNode, { kind: "binary" }>["operator"],
  right: string
): MathAstNode {
  return { id, kind: "binary", left, operator, right };
}

function u(
  id: string,
  operand: string,
  operator: Extract<MathAstNode, { kind: "unary" }>["operator"]
): MathAstNode {
  return { id, kind: "unary", operand, operator };
}

function v(name: MathVariableName): MathAstNode {
  return { id: name, kind: "variable", name };
}

function lit(expression: string): MathAstNode {
  return {
    id: `literal-${expression}`,
    kind: "literal",
    value: scalar(expression),
  };
}

function variableAst(variable: MathVariableName) {
  return expr(variable, [v(variable)], variable);
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
  return ExactPoint3.make({ x: scalar(x), y: scalar(y), z: scalar(z) });
}

function scalar(expression: string) {
  return ExactScalar.make({ expression, latex: expression });
}
