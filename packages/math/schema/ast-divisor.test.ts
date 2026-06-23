import { decodeMathAst, MathAstDecodeError } from "@repo/math/schema/ast";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("MathAst constant divisor validation", () => {
  it("rejects literal zero divisors with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x / 0",
        latex: "x / 0",
        nodes: [
          {
            id: "x",
            kind: "variable",
            name: "x",
          },
          {
            id: "zero",
            kind: "literal",
            value: scalar("0.0"),
          },
          {
            id: "quotient",
            kind: "binary",
            left: "x",
            operator: "divide",
            right: "zero",
          },
        ],
        root: "quotient",
      })
    );

    expectMathAstFailure(exit).toBe(
      "MathAst divide node quotient cannot use a constant zero divisor."
    );
  });

  it("rejects constant zero divisor subtrees with a typed error", async () => {
    const cases = [
      {
        canonical: "x / -0",
        latex: "x / -0",
        nodes: [
          { id: "x", kind: "variable", name: "x" },
          { id: "zero", kind: "literal", value: scalar("0") },
          {
            id: "negated-zero",
            kind: "unary",
            operand: "zero",
            operator: "negate",
          },
          {
            id: "quotient",
            kind: "binary",
            left: "x",
            operator: "divide",
            right: "negated-zero",
          },
        ],
        root: "quotient",
      },
      {
        canonical: "x / (0 * 1)",
        latex: "x / (0 * 1)",
        nodes: [
          { id: "x", kind: "variable", name: "x" },
          { id: "zero", kind: "literal", value: scalar("0") },
          { id: "one", kind: "literal", value: scalar("1") },
          {
            id: "zero-product",
            kind: "binary",
            left: "zero",
            operator: "multiply",
            right: "one",
          },
          {
            id: "quotient",
            kind: "binary",
            left: "x",
            operator: "divide",
            right: "zero-product",
          },
        ],
        root: "quotient",
      },
    ];

    for (const input of cases) {
      const exit = await Effect.runPromiseExit(decodeMathAst(input));
      expectMathAstFailure(exit).toBe(
        "MathAst divide node quotient cannot use a constant zero divisor."
      );
    }
  });

  it("rejects invalid constant subtrees with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "sqrt(-1)",
        latex: "sqrt(-1)",
        nodes: [
          { id: "negative-one", kind: "literal", value: scalar("-1") },
          {
            id: "root",
            kind: "unary",
            operand: "negative-one",
            operator: "sqrt",
          },
        ],
        root: "root",
      })
    );

    expectMathAstFailure(exit).toBe(
      "MathAst node root contains an invalid constant expression."
    );
  });

  it("rejects exact trigonometric zero divisor subtrees", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x / sin(pi)",
        latex: "x / sin(pi)",
        nodes: [
          { id: "x", kind: "variable", name: "x" },
          { id: "pi", kind: "literal", value: scalar("pi") },
          {
            id: "sin-pi",
            kind: "unary",
            operand: "pi",
            operator: "sin",
          },
          {
            id: "quotient",
            kind: "binary",
            left: "x",
            operator: "divide",
            right: "sin-pi",
          },
        ],
        root: "quotient",
      })
    );

    expectMathAstFailure(exit).toBe(
      "MathAst divide node quotient cannot use a constant zero divisor."
    );
  });
});

function scalar(expression: string) {
  return {
    expression,
    latex: expression,
  };
}

/** Extracts and asserts one typed MathAst decode failure. */
function expectMathAstFailure(exit: Exit.Exit<unknown, unknown>) {
  const failure = readExitFailure(exit);

  expect(failure).toBeInstanceOf(MathAstDecodeError);
  if (!(failure instanceof MathAstDecodeError)) {
    throw new Error("Expected MathAstDecodeError.");
  }

  return expect(failure.message);
}

function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
