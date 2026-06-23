import {
  decodeMathAst,
  MAX_MATH_AST_DISPLAY_LENGTH,
  MAX_MATH_AST_NODE_ID_LENGTH,
  MAX_MATH_AST_NODES,
  MathAstDecodeError,
} from "@repo/math/schema/ast/schema";
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

  it("rejects graphs above the node budget", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x",
        latex: "x",
        nodes: Array.from({ length: MAX_MATH_AST_NODES + 1 }, (_, index) => ({
          id: `node-${index}`,
          kind: "variable",
          name: "x",
        })),
        root: "node-0",
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe("Invalid MathAst contract.");
    }
  });

  it("rejects display metadata above the budget", async () => {
    for (const input of [
      {
        canonical: "x".repeat(MAX_MATH_AST_DISPLAY_LENGTH + 1),
        latex: "x",
      },
      {
        canonical: "x",
        latex: "x".repeat(MAX_MATH_AST_DISPLAY_LENGTH + 1),
      },
    ]) {
      const exit = await Effect.runPromiseExit(
        decodeMathAst({
          ...input,
          nodes: [
            {
              id: "x",
              kind: "variable",
              name: "x",
            },
          ],
          root: "x",
        })
      );

      const failure = readExitFailure(exit);

      expect(failure).toBeInstanceOf(MathAstDecodeError);
      if (failure instanceof MathAstDecodeError) {
        expect(failure.message).toBe("Invalid MathAst contract.");
      }
    }
  });

  it("rejects node ids above the id budget", async () => {
    const nodeId = `node-${"x".repeat(MAX_MATH_AST_NODE_ID_LENGTH)}`;
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x",
        latex: "x",
        nodes: [
          {
            id: nodeId,
            kind: "variable",
            name: "x",
          },
        ],
        root: nodeId,
      })
    );

    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(MathAstDecodeError);
    if (failure instanceof MathAstDecodeError) {
      expect(failure.message).toBe("Invalid MathAst contract.");
    }
  });

  it("rejects exact scalar metadata above the display budget", async () => {
    for (const value of [
      {
        expression: "1".repeat(MAX_MATH_AST_DISPLAY_LENGTH + 1),
        latex: "1",
      },
      {
        expression: "1",
        latex: "1".repeat(MAX_MATH_AST_DISPLAY_LENGTH + 1),
      },
    ]) {
      const exit = await Effect.runPromiseExit(
        decodeMathAst({
          canonical: "1",
          latex: "1",
          nodes: [
            {
              id: "one",
              kind: "literal",
              value,
            },
          ],
          root: "one",
        })
      );

      const failure = readExitFailure(exit);

      expect(failure).toBeInstanceOf(MathAstDecodeError);
      if (failure instanceof MathAstDecodeError) {
        expect(failure.message).toBe("Invalid MathAst contract.");
      }
    }
  });

  it("accepts a linear graph inside the node budget", async () => {
    const ast = await Effect.runPromise(
      decodeMathAst({
        canonical: "-x",
        latex: "-x",
        nodes: createLinearNodes(32),
        root: "node-31",
      })
    );

    expect(ast.nodes).toHaveLength(32);
  });
});

function scalar(expression: string) {
  return {
    expression,
    latex: expression,
  };
}

function createLinearNodes(count: number) {
  const nodes: unknown[] = [
    {
      id: "node-0",
      kind: "variable",
      name: "x",
    },
  ];

  for (let index = 1; index < count; index += 1) {
    nodes.push({
      id: `node-${index}`,
      kind: "unary",
      operand: `node-${index - 1}`,
      operator: "negate",
    });
  }

  return nodes;
}

/** Extracts the typed Effect failure from an Exit for schema assertions. */
function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
