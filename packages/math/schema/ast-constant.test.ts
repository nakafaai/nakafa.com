import { ExactScalar, type MathAstNode } from "@repo/math/schema/ast";
import {
  type ConstantMathAstValue,
  readConstantMathAstValue,
} from "@repo/math/schema/ast-constant";
import { describe, expect, it } from "vitest";

type BinaryOperator = Extract<MathAstNode, { kind: "binary" }>["operator"];
type UnaryOperator = Extract<MathAstNode, { kind: "unary" }>["operator"];

describe("MathAst constant evaluation", () => {
  it("reads literals through the sortable scalar contract with a shared cache", () => {
    const cache = new Map<string, ConstantMathAstValue | undefined>();
    const nodes = [literalNode("two", "2")];

    const firstRead = readValue("two", nodes, cache);
    const secondRead = readValue("two", nodes, cache);

    expectValue(firstRead, 2);
    expect(secondRead).toEqual(firstRead);
  });

  it("returns undefined for nonconstant or invalid subtrees", () => {
    expect(readValue("x", [variableNode("x")])).toBeUndefined();
    expect(readValue("bad", [literalNode("bad", "left")])).toBeUndefined();
    expect(
      readValue("missing", [unaryNode("missing", "nope", "negate")])
    ).toBeUndefined();
    expect(
      readValue("partial", [
        literalNode("one", "1"),
        binaryNode("partial", "one", "add", "missing"),
      ])
    ).toBeUndefined();
    expect(
      readValue("cycle", [unaryNode("cycle", "cycle", "negate")])
    ).toBeUndefined();
  });

  it("evaluates supported unary constant operations", () => {
    expectUnaryValue("negate", "2", -2);
    expectUnaryValue("abs", "-2", 2);
    expectUnaryValue("sqrt", "4", 2);
    expectUnaryValue("sin", "0", 0);
    expectUnaryValue("sin", "1", Math.sin(1));
    expectUnaryValue("tan", "0", 0);
    expectUnaryValue("tan", "1", Math.tan(1));
    expectUnaryValue("cos", "0", 1);
    expectUnaryValue("exp", "1", Math.E);
    expectUnaryValue("log", "1", 0);

    expect(readUnaryValue("sqrt", "-1")).toBeUndefined();
    expect(readUnaryValue("log", "0")).toBeUndefined();
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

    expect(readBinaryValue("1", "divide", "0")).toBeUndefined();
    expect(readBinaryValue("1e308", "multiply", "1e308")).toBeUndefined();
    expect(readBinaryValue("1e308", "power", "2")).toBeUndefined();
  });
});

function readUnaryValue(operator: UnaryOperator, operand: string) {
  return readValue("root", [
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
  return readValue("root", [
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
  cache?: Map<string, ConstantMathAstValue | undefined>
) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const root = nodesById.get(rootId);

  expect(root).toBeDefined();
  if (!root) {
    return;
  }

  return cache
    ? readConstantMathAstValue(root, nodesById, cache)
    : readConstantMathAstValue(root, nodesById);
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
