import {
  mathAlgebraInput,
  mathArithmeticInput,
  mathDiscreteInput,
  mathMatrixInput,
} from "@repo/ai/agents/math/schema";
import { asSchema } from "ai";
import { describe, expect, it } from "vitest";

describe("math AI input schemas", () => {
  it("exposes Effect schemas as AI SDK-compatible JSON schemas", async () => {
    const schema = asSchema(mathArithmeticInput);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Math input schema must validate model tool input.");
    }

    expect(jsonSchema).toMatchObject({
      description: "Exact arithmetic tool input.",
      properties: {
        expression: {
          description:
            "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
          type: "string",
        },
        operation: {
          description: "Evaluate an exact arithmetic or numeric expression.",
          enum: ["evaluate"],
          type: "string",
        },
      },
      required: ["expression", "operation"],
      type: "object",
    });

    await expect(
      Promise.resolve(
        validate({
          expression: "2 + 2",
          operation: "evaluate",
        })
      )
    ).resolves.toEqual({
      success: true,
      value: {
        expression: "2 + 2",
        operation: "evaluate",
      },
    });

    await expect(
      Promise.resolve(
        validate({
          expression: "2 + 2",
          operation: "simplify",
        })
      )
    ).resolves.toMatchObject({
      success: false,
    });
  });

  it("rejects algebra operations that omit their required expression fields", async () => {
    const schema = asSchema(mathAlgebraInput);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Math algebra schema must validate model tool input.");
    }

    await expect(
      Promise.resolve(
        validate({
          operation: "simplify",
        })
      )
    ).resolves.toMatchObject({
      success: false,
    });

    await expect(
      Promise.resolve(
        validate({
          operation: "domain",
        })
      )
    ).resolves.toMatchObject({
      success: false,
    });

    await expect(
      Promise.resolve(
        validate({
          expression: "(x^2 - 9)/(x - 3)",
          operation: "simplify",
        })
      )
    ).resolves.toEqual({
      success: true,
      value: {
        expression: "(x^2 - 9)/(x - 3)",
        operation: "simplify",
      },
    });
  });

  it("requires both sides for algebra comparison", async () => {
    const schema = asSchema(mathAlgebraInput);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Math algebra schema must validate model tool input.");
    }

    await expect(
      Promise.resolve(
        validate({
          left: "(x^2 - 9)/(x - 3)",
          operation: "compare",
        })
      )
    ).resolves.toMatchObject({
      success: false,
    });

    await expect(
      Promise.resolve(
        validate({
          left: "(x^2 - 9)/(x - 3)",
          operation: "compare",
          right: "x + 3",
        })
      )
    ).resolves.toEqual({
      success: true,
      value: {
        left: "(x^2 - 9)/(x - 3)",
        operation: "compare",
        right: "x + 3",
      },
    });
  });

  it("requires values for discrete operations that use integer lists", async () => {
    const schema = asSchema(mathDiscreteInput);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Math discrete schema must validate model tool input.");
    }

    await expect(
      Promise.resolve(
        validate({
          operation: "gcd",
        })
      )
    ).resolves.toMatchObject({
      success: false,
    });

    await expect(
      Promise.resolve(
        validate({
          operation: "gcd",
          values: ["84", "30"],
        })
      )
    ).resolves.toEqual({
      success: true,
      value: {
        operation: "gcd",
        values: ["84", "30"],
      },
    });
  });

  it("requires the second matrix for matrix multiplication", async () => {
    const schema = asSchema(mathMatrixInput);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Math matrix schema must validate model tool input.");
    }

    await expect(
      Promise.resolve(
        validate({
          matrix: [["1"]],
          operation: "matrix_multiply",
        })
      )
    ).resolves.toMatchObject({
      success: false,
    });

    await expect(
      Promise.resolve(
        validate({
          matrix: [["1"]],
          operation: "matrix_multiply",
          right_matrix: [["2"]],
        })
      )
    ).resolves.toEqual({
      success: true,
      value: {
        matrix: [["1"]],
        operation: "matrix_multiply",
        right_matrix: [["2"]],
      },
    });
  });
});
