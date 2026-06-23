import { decodeMathAst, MathAstDecodeError } from "@repo/math/schema/ast";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("MathAst", () => {
  it("decodes a flat symbolic expression graph", async () => {
    const ast = await Effect.runPromise(
      decodeMathAst({
        canonical: "x + x",
        latex: "x + x",
        nodes: [
          {
            id: "x",
            kind: "variable",
            name: "x",
          },
          {
            id: "sum",
            kind: "binary",
            left: "x",
            operator: "add",
            right: "x",
          },
        ],
        root: "sum",
      })
    );

    expect(ast.root).toBe("sum");
    expect(ast.nodes).toHaveLength(2);
  });

  it("decodes unary expressions with valid operand references", async () => {
    const ast = await Effect.runPromise(
      decodeMathAst({
        canonical: "-x",
        latex: "-x",
        nodes: [
          {
            id: "x",
            kind: "variable",
            name: "x",
          },
          {
            id: "negate-x",
            kind: "unary",
            operand: "x",
            operator: "negate",
          },
        ],
        root: "negate-x",
      })
    );

    expect(ast.root).toBe("negate-x");
  });

  it("rejects invalid schema shapes with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "1",
        latex: "1",
        nodes: [],
        root: "one",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe("Invalid MathAst contract.");
    }
  });

  it("rejects blank exact scalar expressions with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: " ",
        latex: " ",
        nodes: [
          {
            id: "blank",
            kind: "literal",
            value: scalar("   "),
          },
        ],
        root: "blank",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe("Invalid MathAst contract.");
    }
  });

  it("rejects blank node ids with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "1",
        latex: "1",
        nodes: [
          {
            id: "   ",
            kind: "literal",
            value: scalar("1"),
          },
        ],
        root: "   ",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe("Invalid MathAst contract.");
    }
  });

  it("rejects nonnumeric literal values with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "left",
        latex: "left",
        nodes: [
          {
            id: "literal-left",
            kind: "literal",
            value: scalar("left"),
          },
        ],
        root: "literal-left",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe(
        "MathAst literal node literal-left must use a sortable numeric value."
      );
    }
  });

  it("rejects duplicate node ids with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "1",
        latex: "1",
        nodes: [
          {
            id: "one",
            kind: "literal",
            value: scalar("1"),
          },
          {
            id: "one",
            kind: "literal",
            value: scalar("1"),
          },
        ],
        root: "one",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe("Duplicate MathAst node id: one.");
    }
  });

  it("rejects missing root nodes with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "1",
        latex: "1",
        nodes: [
          {
            id: "one",
            kind: "literal",
            value: scalar("1"),
          },
        ],
        root: "missing",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe("MathAst root node was not found: missing.");
    }
  });

  it("rejects cyclic graphs with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "-(-x)",
        latex: "-(-x)",
        nodes: [
          {
            id: "first",
            kind: "unary",
            operand: "second",
            operator: "negate",
          },
          {
            id: "second",
            kind: "unary",
            operand: "first",
            operator: "negate",
          },
        ],
        root: "first",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe(
        "MathAst graph contains a cycle at node first."
      );
    }
  });

  it("rejects unreachable nodes with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "1",
        latex: "1",
        nodes: [
          {
            id: "one",
            kind: "literal",
            value: scalar("1"),
          },
          {
            id: "x",
            kind: "variable",
            name: "x",
          },
        ],
        root: "one",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe("MathAst node is unreachable from root: x.");
    }
  });

  it("rejects missing unary operands with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "-x",
        latex: "-x",
        nodes: [
          {
            id: "negate-x",
            kind: "unary",
            operand: "x",
            operator: "negate",
          },
        ],
        root: "negate-x",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe(
        "MathAst unary node negate-x references missing operand x."
      );
    }
  });

  it("rejects missing node references with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x + 1",
        latex: "x + 1",
        nodes: [
          {
            id: "sum",
            kind: "binary",
            left: "x",
            operator: "add",
            right: "one",
          },
        ],
        root: "sum",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe(
        "MathAst binary node sum references missing left operand x."
      );
    }
  });

  it("rejects missing right operands with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x + 1",
        latex: "x + 1",
        nodes: [
          {
            id: "x",
            kind: "variable",
            name: "x",
          },
          {
            id: "sum",
            kind: "binary",
            left: "x",
            operator: "add",
            right: "one",
          },
        ],
        root: "sum",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe(
        "MathAst binary node sum references missing right operand one."
      );
    }
  });

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

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe(
        "MathAst divide node quotient cannot use a constant zero divisor."
      );
    }
  });

  it("rejects constant zero divisor subtrees with a typed error", async () => {
    const cases = [
      {
        canonical: "x / -0",
        latex: "x / -0",
        nodes: [
          {
            id: "x",
            kind: "variable",
            name: "x",
          },
          {
            id: "zero",
            kind: "literal",
            value: scalar("0"),
          },
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
          {
            id: "x",
            kind: "variable",
            name: "x",
          },
          {
            id: "zero",
            kind: "literal",
            value: scalar("0"),
          },
          {
            id: "one",
            kind: "literal",
            value: scalar("1"),
          },
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
      const failure = readExitFailure(exit);

      expect(failure).toBeInstanceOf(MathAstDecodeError);
      if (failure instanceof MathAstDecodeError) {
        expect(failure.message).toBe(
          "MathAst divide node quotient cannot use a constant zero divisor."
        );
      }
    }
  });

  it("rejects invalid constant subtrees with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "sqrt(-1)",
        latex: "sqrt(-1)",
        nodes: [
          {
            id: "negative-one",
            kind: "literal",
            value: scalar("-1"),
          },
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

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe(
        "MathAst node root contains an invalid constant expression."
      );
    }
  });

  it("rejects exact trigonometric zero divisor subtrees", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x / sin(pi)",
        latex: "x / sin(pi)",
        nodes: [
          {
            id: "x",
            kind: "variable",
            name: "x",
          },
          {
            id: "pi",
            kind: "literal",
            value: scalar("pi"),
          },
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

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe(
        "MathAst divide node quotient cannot use a constant zero divisor."
      );
    }
  });
});

function scalar(expression: string) {
  return {
    expression,
    latex: expression,
  };
}

/** Extracts the typed Effect failure from an Exit for schema assertions. */
function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
