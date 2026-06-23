import { decodeMathAst, MathAstDecodeError } from "@repo/math/schema/ast";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("MathAst", () => {
  it("decodes a flat symbolic expression graph", async () => {
    const ast = await Effect.runPromise(
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
            id: "one",
            kind: "literal",
            value: scalar("1"),
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

    expect(ast.root).toBe("sum");
    expect(ast.nodes).toHaveLength(3);
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
