import { ExactScalar, type MathAstNode } from "@repo/math/schema/ast";
import {
  type ConstantMathAstRead,
  type ConstantMathAstValue,
  readConstantMathAst,
} from "@repo/math/schema/ast-constant";
import { describe, expect, it } from "vitest";

type BinaryOperator = Extract<MathAstNode, { kind: "binary" }>["operator"];
type UnaryOperator = Extract<MathAstNode, { kind: "unary" }>["operator"];

describe("MathAst constant evaluation", () => {
  it("reads literals through the sortable scalar contract with a shared cache", () => {
    const cache = new Map<string, ConstantMathAstRead>();
    const nodes = [literalNode("two", "2")];

    const firstRead = readValue("two", nodes, cache);
    const secondRead = readValue("two", nodes, cache);

    expectValue(firstRead, 2);
    expect(secondRead).toEqual(firstRead);
  });

  it("distinguishes nonconstant and invalid subtrees", () => {
    expect(readResult("x", [variableNode("x")]).tag).toBe("Nonconstant");
    expect(readResult("bad", [literalNode("bad", "left")]).tag).toBe(
      "InvalidConstant"
    );
    expect(
      readResult("missing", [unaryNode("missing", "nope", "negate")]).tag
    ).toBe("Nonconstant");
    expect(
      readResult("partial", [
        literalNode("one", "1"),
        binaryNode("partial", "one", "add", "missing"),
      ]).tag
    ).toBe("Nonconstant");
    expect(
      readResult("cycle", [unaryNode("cycle", "cycle", "negate")]).tag
    ).toBe("Nonconstant");
    expect(
      readResult("invalid-sum", [
        literalNode("negative-one", "-1"),
        unaryNode("sqrt-negative", "negative-one", "sqrt"),
        literalNode("one", "1"),
        binaryNode("invalid-sum", "sqrt-negative", "add", "one"),
      ]).tag
    ).toBe("InvalidConstant");
  });

  it("evaluates supported unary constant operations", () => {
    expectUnaryValue("negate", "2", -2);
    expectUnaryValue("abs", "-2", 2);
    expectUnaryValue("sqrt", "4", 2);
    expectUnaryValue("sin", "0", 0);
    expectUnaryValue("sin", "pi", 0);
    expectUnaryValue("sin", "1", Math.sin(1));
    expectUnaryValue("sin", "3.141592653589793", Math.sin(Math.PI));
    expectUnaryValue("sin", "1e-13", Math.sin(1e-13));
    expectUnaryValue("tan", "0", 0);
    expectUnaryValue("tan", "pi", 0);
    expectUnaryValue("tan", "1", Math.tan(1));
    expectUnaryValue("cos", "0", 1);
    expectUnaryValue("cos", "pi/2", 0);
    expectUnaryValue("exp", "1", Math.E);
    expectUnaryValue("log", "1", 0);

    expect(readUnaryResult("sqrt", "-1").tag).toBe("InvalidConstant");
    expect(readUnaryResult("tan", "pi/2").tag).toBe("InvalidConstant");
    expect(readUnaryResult("log", "0").tag).toBe("InvalidConstant");
  });

  it("evaluates supported binary constant operations", () => {
    expectBinaryValue("1", "add", "2", 3);
    expectBinaryValue("1", "subtract", "1", 0);
    expectBinaryValue("0", "multiply", "7", 0);
    expectBinaryValue("7", "multiply", "0", 0);
    expectBinaryValue("2", "multiply", "3", 6);
    expectBinaryValue("0", "divide", "7", 0);
    expectBinaryValue("4", "divide", "2", 2);
    expectBinaryValue("0", "power", "2", 0);
    expectBinaryValue("0", "power", "0", 1);
    expectBinaryValue("2", "power", "3", 8);

    expect(readBinaryResult("1", "divide", "0").tag).toBe("InvalidConstant");
    expect(readBinaryResult("1e-200", "multiply", "1e-200").tag).toBe(
      "InvalidConstant"
    );
    expect(readBinaryResult("1e-200", "divide", "1e200").tag).toBe(
      "InvalidConstant"
    );
    expect(readBinaryResult("1e-200", "power", "2").tag).toBe(
      "InvalidConstant"
    );
    expect(readBinaryResult("1e308", "multiply", "1e308").tag).toBe(
      "InvalidConstant"
    );
    expect(readBinaryResult("1e308", "power", "2").tag).toBe("InvalidConstant");
  });
});

function readUnaryValue(operator: UnaryOperator, operand: string) {
  return readConstantValue(readUnaryResult(operator, operand));
}

function readUnaryResult(operator: UnaryOperator, operand: string) {
  return readResult("root", [
    literalNode("operand", operand),
    unaryNode("root", "operand", operator),
  ]);
}

function expectUnaryValue(
  operator: UnaryOperator,
  operand: string,
  expected: number
) {
  expectValue(readUnaryValue(operator, operand), expected);
}

function readBinaryValue(
  left: string,
  operator: BinaryOperator,
  right: string
) {
  return readConstantValue(readBinaryResult(left, operator, right));
}

function readBinaryResult(
  left: string,
  operator: BinaryOperator,
  right: string
) {
  return readResult("root", [
    literalNode("left", left),
    literalNode("right", right),
    binaryNode("root", "left", operator, "right"),
  ]);
}

function expectBinaryValue(
  left: string,
  operator: BinaryOperator,
  right: string,
  expected: number
) {
  expectValue(readBinaryValue(left, operator, right), expected);
}

function readValue(
  rootId: string,
  nodes: readonly MathAstNode[],
  cache?: Map<string, ConstantMathAstRead>
) {
  return readConstantValue(readResult(rootId, nodes, cache));
}

function readResult(
  rootId: string,
  nodes: readonly MathAstNode[],
  cache?: Map<string, ConstantMathAstRead>
) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const root = nodesById.get(rootId);

  expect(root).toBeDefined();
  if (!root) {
    return { tag: "Nonconstant" } satisfies ConstantMathAstRead;
  }

  return cache
    ? readConstantMathAst(root, nodesById, cache)
    : readConstantMathAst(root, nodesById);
}

function readConstantValue(read: ConstantMathAstRead) {
  return read.tag === "Constant" ? read.value : undefined;
}

function expectValue(
  actual: ConstantMathAstValue | undefined,
  expected: number
) {
  expect(actual?.value).toBeCloseTo(expected);
  expect(actual?.isExactZero).toBe(expected === 0);
}

function binaryNode(
  id: string,
  left: string,
  operator: BinaryOperator,
  right: string
): MathAstNode {
  return { id, kind: "binary", left, operator, right };
}

function literalNode(id: string, expression: string): MathAstNode {
  return {
    id,
    kind: "literal",
    value: ExactScalar.make({
      expression,
      latex: expression,
    }),
  };
}

function unaryNode(
  id: string,
  operand: string,
  operator: UnaryOperator
): MathAstNode {
  return { id, kind: "unary", operand, operator };
}

function variableNode(name: "x"): MathAstNode {
  return { id: name, kind: "variable", name };
}
