import {
  decodeMathAst,
  MathAstDecodeError,
  type MathAstNode,
} from "@repo/math/schema/ast/schema";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

const ZERO_DIVISOR =
  "MathAst divide node quotient cannot use a constant zero divisor.";

describe("MathAst graph validation", () => {
  it("rejects malformed graph structure with typed messages", async () => {
    const cases = [
      {
        expected:
          "MathAst literal node literal-left must use a sortable numeric value.",
        input: ast("left", [literal("literal-left", "left")], "literal-left"),
      },
      {
        expected: "Duplicate MathAst node id: one.",
        input: ast("1", [literal("one", "1"), literal("one", "1")], "one"),
      },
      {
        expected: "MathAst root node was not found: missing.",
        input: ast("1", [literal("one", "1")], "missing"),
      },
      {
        expected: "MathAst graph contains a cycle at node first.",
        input: ast(
          "-(-x)",
          [
            unary("first", "second", "negate"),
            unary("second", "first", "negate"),
          ],
          "first"
        ),
      },
      {
        expected: "MathAst node is unreachable from root: x.",
        input: ast("1", [literal("one", "1"), variable("x")], "one"),
      },
      {
        expected: "MathAst unary node negate-x references missing operand x.",
        input: ast("-x", [unary("negate-x", "x", "negate")], "negate-x"),
      },
      {
        expected: "MathAst binary node sum references missing left operand x.",
        input: ast("x + 1", [binary("sum", "x", "add", "one")], "sum"),
      },
      {
        expected:
          "MathAst binary node sum references missing right operand one.",
        input: ast(
          "x + 1",
          [variable("x"), binary("sum", "x", "add", "one")],
          "sum"
        ),
      },
    ];

    for (const testCase of cases) {
      await expectDecodeIssue(testCase.input, testCase.expected);
    }
  });

  it("rejects constant zero and invalid constant divisor subtrees", async () => {
    const cases = [
      {
        expected: ZERO_DIVISOR,
        input: quotientAst("x / 0", [literal("zero", "0.0")], "zero"),
      },
      {
        expected: ZERO_DIVISOR,
        input: quotientAst(
          "x / -0",
          [literal("zero", "0"), unary("negated-zero", "zero", "negate")],
          "negated-zero"
        ),
      },
      {
        expected: ZERO_DIVISOR,
        input: quotientAst(
          "x / (0 * 1)",
          [
            literal("zero", "0"),
            literal("one", "1"),
            binary("zero-product", "zero", "multiply", "one"),
          ],
          "zero-product"
        ),
      },
      {
        expected: ZERO_DIVISOR,
        input: quotientAst(
          "x / sin(pi)",
          [literal("pi", "pi"), unary("sin-pi", "pi", "sin")],
          "sin-pi"
        ),
      },
      {
        expected: ZERO_DIVISOR,
        input: quotientAst(
          "x / sin(sqrt(pi*pi))",
          [
            literal("pi-left", "pi"),
            literal("pi-right", "pi"),
            binary("pi-squared", "pi-left", "multiply", "pi-right"),
            unary("sqrt-pi", "pi-squared", "sqrt"),
            unary("sin-pi", "sqrt-pi", "sin"),
          ],
          "sin-pi"
        ),
      },
      {
        expected:
          "MathAst node scaled-pi contains an invalid constant expression.",
        input: quotientAst(
          "x / sin((pi / 3) * 3)",
          [
            literal("one-third-pi", "pi/3"),
            literal("three", "3"),
            binary("scaled-pi", "one-third-pi", "multiply", "three"),
            unary("sin-pi", "scaled-pi", "sin"),
          ],
          "sin-pi"
        ),
      },
      {
        expected: ZERO_DIVISOR,
        input: quotientAst(
          "x / sin((pi*pi)/pi)",
          [
            literal("pi-left", "pi"),
            literal("pi-right", "pi"),
            binary("pi-squared", "pi-left", "multiply", "pi-right"),
            binary("reduced-pi", "pi-squared", "divide", "pi-right"),
            unary("sin-pi", "reduced-pi", "sin"),
          ],
          "sin-pi"
        ),
      },
      {
        expected: ZERO_DIVISOR,
        input: quotientAst(
          "x / sin((pi^2)/pi)",
          [
            literal("pi", "pi"),
            literal("two", "2"),
            binary("pi-squared", "pi", "power", "two"),
            binary("reduced-pi", "pi-squared", "divide", "pi"),
            unary("sin-pi", "reduced-pi", "sin"),
          ],
          "sin-pi"
        ),
      },
      {
        expected: ZERO_DIVISOR,
        input: quotientAst(
          "x / sin(abs(pi*pi)/pi)",
          [
            literal("pi-left", "pi"),
            literal("pi-right", "pi"),
            binary("pi-squared", "pi-left", "multiply", "pi-right"),
            unary("abs-pi-squared", "pi-squared", "abs"),
            binary("reduced-pi", "abs-pi-squared", "divide", "pi-right"),
            unary("sin-pi", "reduced-pi", "sin"),
          ],
          "sin-pi"
        ),
      },
      {
        expected: "MathAst node sum contains an invalid constant expression.",
        input: quotientAst(
          "x / sin((9007199254740991*pi) + (0.5*pi))",
          [
            literal("large", "9007199254740991*pi"),
            literal("half", "0.5*pi"),
            binary("sum", "large", "add", "half"),
            unary("sin-sum", "sum", "sin"),
          ],
          "sin-sum"
        ),
      },
      {
        expected: "MathAst node root contains an invalid constant expression.",
        input: ast("sqrt(-1)", [
          literal("negative-one", "-1"),
          unary("root", "negative-one", "sqrt"),
        ]),
      },
    ];

    for (const testCase of cases) {
      await expectDecodeIssue(testCase.input, testCase.expected);
    }
  });
});

async function expectDecodeIssue(input: unknown, message: string) {
  const exit = await Effect.runPromiseExit(decodeMathAst(input));
  const failure = readExitFailure(exit);

  expect(failure).toBeInstanceOf(MathAstDecodeError);
  if (failure instanceof MathAstDecodeError) {
    expect(failure.message).toBe(message);
  }
}

function ast(canonical: string, nodes: readonly MathAstNode[], root = "root") {
  return {
    canonical,
    latex: canonical,
    nodes,
    root,
  };
}

function quotientAst(
  canonical: string,
  denominatorNodes: readonly MathAstNode[],
  denominatorId: string
) {
  return ast(
    canonical,
    [
      variable("x"),
      ...denominatorNodes,
      binary("quotient", "x", "divide", denominatorId),
    ],
    "quotient"
  );
}

function binary(
  id: string,
  left: string,
  operator: Extract<MathAstNode, { kind: "binary" }>["operator"],
  right: string
): MathAstNode {
  return { id, kind: "binary", left, operator, right };
}

function literal(id: string, expression: string): MathAstNode {
  return {
    id,
    kind: "literal",
    value: {
      expression,
      latex: expression,
    },
  };
}

function unary(
  id: string,
  operand: string,
  operator: Extract<MathAstNode, { kind: "unary" }>["operator"]
): MathAstNode {
  return { id, kind: "unary", operand, operator };
}

function variable(name: "x"): MathAstNode {
  return { id: name, kind: "variable", name };
}

function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
