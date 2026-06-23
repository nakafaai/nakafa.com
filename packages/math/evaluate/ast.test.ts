import { readMathAstNumber } from "@repo/math/evaluate/ast";
import { MathAst } from "@repo/math/schema/ast/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("readMathAstNumber", () => {
  it("evaluates bounded variable graphs deterministically", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "x^2 + y",
        latex: "x^2 + y",
        nodes: [
          variable("x", "x"),
          literal("two", "2"),
          binary("square", "power", "x", "two"),
          variable("y", "y"),
          binary("root", "add", "square", "y"),
        ],
        root: "root",
      }),
      new Map([
        ["x", 3],
        ["y", 4],
      ])
    );

    expect(result).toEqual({ tag: "value", value: 13 });
  });

  it("reports missing variables without throwing", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "x + 1",
        latex: "x + 1",
        nodes: [
          variable("x", "x"),
          literal("one", "1"),
          binary("root", "add", "x", "one"),
        ],
        root: "root",
      }),
      new Map()
    );

    expect(result).toEqual({
      message: "Variable x is missing or non-finite.",
      tag: "issue",
    });
  });

  it("reports malformed references without recursive traversal", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "missing",
        latex: "missing",
        nodes: [literal("one", "1")],
        root: "missing",
      }),
      new Map()
    );

    expect(result).toEqual({
      message: "MathAst node missing is missing.",
      tag: "issue",
    });
  });

  it("reports cyclic graphs through typed dependency issues", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "-cycle",
        latex: "-cycle",
        nodes: [unary("cycle", "negate", "cycle")],
        root: "cycle",
      }),
      new Map()
    );

    expect(result).toEqual({
      message: "Node cycle was not evaluated.",
      tag: "issue",
    });
  });

  it("skips already evaluated shared child nodes", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "x + x",
        latex: "x + x",
        nodes: [variable("x", "x"), binary("root", "add", "x", "x")],
        root: "root",
      }),
      new Map([["x", 2]])
    );

    expect(result).toEqual({ tag: "value", value: 4 });
  });

  it("does not reschedule dependencies that were evaluated earlier", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "-x + x",
        latex: "-x + x",
        nodes: [
          variable("x", "x"),
          unary("negated", "negate", "x"),
          binary("root", "add", "negated", "x"),
        ],
        root: "root",
      }),
      new Map([["x", 3]])
    );

    expect(result).toEqual({ tag: "value", value: 0 });
  });

  it("rejects undefined sample domains", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "sqrt(x)",
        latex: "\\sqrt{x}",
        nodes: [variable("x", "x"), unary("root", "sqrt", "x")],
        root: "root",
      }),
      new Map([["x", -1]])
    );

    expect(result).toEqual({
      message: "Square root is undefined for negative samples.",
      tag: "issue",
    });
  });

  it("evaluates supported unary operators", () => {
    expect(unaryResult("negate", 2)).toEqual({ tag: "value", value: -2 });
    expect(unaryResult("abs", -2)).toEqual({ tag: "value", value: 2 });
    expect(unaryResult("sqrt", 4)).toEqual({ tag: "value", value: 2 });
    expect(unaryResult("sin", 0)).toEqual({ tag: "value", value: 0 });
    expect(unaryResult("cos", 0)).toEqual({ tag: "value", value: 1 });
    expect(unaryResult("tan", 0)).toEqual({ tag: "value", value: 0 });
    expect(unaryResult("log", 1)).toEqual({ tag: "value", value: 0 });
  });

  it("rejects invalid unary dependencies", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "-left",
        latex: "-left",
        nodes: [literal("bad", "left"), unary("root", "negate", "bad")],
        root: "root",
      }),
      new Map()
    );

    expect(result).toEqual({
      message: "Literal bad is not a finite exact scalar.",
      tag: "issue",
    });
  });

  it("rejects invalid logarithm samples", () => {
    expect(unaryResult("log", 0)).toEqual({
      message: "Logarithm is undefined for non-positive samples.",
      tag: "issue",
    });
  });

  it("rejects non-finite computed samples", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "exp(x)",
        latex: "e^x",
        nodes: [variable("x", "x"), unary("root", "exp", "x")],
        root: "root",
      }),
      new Map([["x", 1000]])
    );

    expect(result).toEqual({
      message: "MathAst evaluation produced a non-finite value.",
      tag: "issue",
    });
  });

  it("rejects zero to the zero power", () => {
    const result = readMathAstNumber(
      ast({
        canonical: "0^0",
        latex: "0^0",
        nodes: [
          literal("zero-left", "0"),
          literal("zero-right", "0"),
          binary("root", "power", "zero-left", "zero-right"),
        ],
        root: "root",
      }),
      new Map()
    );

    expect(result).toEqual({
      message: "Zero to the zero power is undefined.",
      tag: "issue",
    });
  });

  it("evaluates supported binary operators", () => {
    expect(binaryResult("subtract", 7, 3)).toEqual({ tag: "value", value: 4 });
    expect(binaryResult("multiply", 7, 3)).toEqual({ tag: "value", value: 21 });
    expect(binaryResult("divide", 8, 2)).toEqual({ tag: "value", value: 4 });
    expect(binaryResult("power", 2, 3)).toEqual({ tag: "value", value: 8 });
  });

  it("rejects invalid binary dependencies and zero divisors", () => {
    expect(binaryResult("add", Number.POSITIVE_INFINITY, 1)).toEqual({
      message: "Variable x is missing or non-finite.",
      tag: "issue",
    });
    expect(binaryResult("add", 1, Number.NaN)).toEqual({
      message: "Variable y is missing or non-finite.",
      tag: "issue",
    });
    expect(binaryResult("divide", 1, 0)).toEqual({
      message: "Division by zero is undefined for this sample.",
      tag: "issue",
    });
  });
});

function ast(input: unknown) {
  return Schema.decodeUnknownSync(MathAst)(input);
}

function literal(id: string, expression: string) {
  return { id, kind: "literal", value: { expression, latex: expression } };
}

function variable(id: string, name: string) {
  return { id, kind: "variable", name };
}

function unary(id: string, operator: string, operand: string) {
  return { id, kind: "unary", operand, operator };
}

function binary(id: string, operator: string, left: string, right: string) {
  return { id, kind: "binary", left, operator, right };
}

function unaryResult(operator: string, value: number) {
  return readMathAstNumber(
    ast({
      canonical: `${operator}(x)`,
      latex: `${operator}(x)`,
      nodes: [variable("x", "x"), unary("root", operator, "x")],
      root: "root",
    }),
    new Map([["x", value]])
  );
}

function binaryResult(operator: string, left: number, right: number) {
  return readMathAstNumber(
    ast({
      canonical: `x ${operator} y`,
      latex: `x ${operator} y`,
      nodes: [
        variable("x", "x"),
        variable("y", "y"),
        binary("root", operator, "x", "y"),
      ],
      root: "root",
    }),
    new Map([
      ["x", left],
      ["y", right],
    ])
  );
}
