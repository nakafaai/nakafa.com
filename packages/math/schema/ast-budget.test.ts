import {
  decodeMathAst,
  MAX_MATH_AST_DISPLAY_LENGTH,
  MAX_MATH_AST_NODE_ID_LENGTH,
  MAX_MATH_AST_NODES,
  MathAstDecodeError,
} from "@repo/math/schema/ast";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("MathAst budgets", () => {
  it("rejects producer-controlled graphs above the node budget", async () => {
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

  it("rejects MathAst canonical text above the display budget", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x".repeat(MAX_MATH_AST_DISPLAY_LENGTH + 1),
        latex: "x",
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
  });

  it("rejects MathAst LaTeX text above the display budget", async () => {
    const exit = await Effect.runPromiseExit(
      decodeMathAst({
        canonical: "x",
        latex: "x".repeat(MAX_MATH_AST_DISPLAY_LENGTH + 1),
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
  });

  it("rejects MathAst node ids above the id budget", async () => {
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

  it("accepts a large linear graph inside the node budget", async () => {
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

/** Extracts the typed Effect failure from an Exit for budget assertions. */
function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
