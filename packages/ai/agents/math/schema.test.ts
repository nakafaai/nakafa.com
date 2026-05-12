import {
  mathAlgebraInput,
  mathArithmeticInput,
  mathDiscreteInput,
  mathEquationInput,
  mathGeometryInput,
  mathMatrixInput,
  mathSeriesInput,
  mathStatisticsInput,
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

  it("rejects malformed geometry points before tool execution", async () => {
    const schema = asSchema(mathGeometryInput);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Math geometry schema must validate model tool input.");
    }

    await expect(
      Promise.resolve(
        validate({
          operation: "midpoint",
          points: [
            { x: "1", y: "2" },
            { x: "4,y:", y: "6" },
          ],
        })
      )
    ).resolves.toMatchObject({
      success: false,
    });

    await expect(
      Promise.resolve(
        validate({
          operation: "midpoint",
          points: [
            { x: "1", y: "2" },
            { x: "4", y: "6" },
          ],
        })
      )
    ).resolves.toEqual({
      success: true,
      value: {
        operation: "midpoint",
        points: [
          { x: "1", y: "2" },
          { x: "4", y: "6" },
        ],
      },
    });
  });

  it("keeps geometry model metadata clear for two-point and four-point operations", async () => {
    const schema = asSchema(mathGeometryInput);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    if (!("properties" in jsonSchema && jsonSchema.properties)) {
      throw new Error("Math geometry schema must expose object properties.");
    }

    const { properties } = jsonSchema;

    expect(jsonSchema).toMatchObject({
      properties: {
        operation: {
          enum: expect.arrayContaining([
            "distance",
            "midpoint",
            "slope",
            "line",
            "intersection",
          ]),
        },
        points: {
          description: expect.stringContaining("Exactly two coordinate points"),
          maxItems: 4,
          minItems: 2,
        },
      },
    });
    expect(properties.points).not.toHaveProperty("title");
    expect(jsonSchema).toMatchObject({
      properties: {
        points: {
          description: expect.stringContaining("Exactly four points"),
        },
      },
    });
  });

  it("exposes grouped tool schemas as provider-compatible objects", async () => {
    const jsonSchemas = [
      await Promise.resolve(asSchema(mathAlgebraInput).jsonSchema),
      await Promise.resolve(asSchema(mathEquationInput).jsonSchema),
      await Promise.resolve(asSchema(mathGeometryInput).jsonSchema),
      await Promise.resolve(asSchema(mathDiscreteInput).jsonSchema),
      await Promise.resolve(asSchema(mathMatrixInput).jsonSchema),
      await Promise.resolve(asSchema(mathSeriesInput).jsonSchema),
      await Promise.resolve(asSchema(mathStatisticsInput).jsonSchema),
    ];

    for (const jsonSchema of jsonSchemas) {
      expect(jsonSchema).not.toHaveProperty("anyOf");
      expect(jsonSchema).toMatchObject({ type: "object" });
    }
  });

  it("keeps model-facing field metadata for grouped algebra tools", async () => {
    const schema = asSchema(mathAlgebraInput);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    expect(jsonSchema).toMatchObject({
      properties: {
        expression: {
          description:
            "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
          type: "string",
        },
        left: {
          description:
            "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
          type: "string",
        },
        operation: {
          enum: expect.arrayContaining(["simplify", "domain", "compare"]),
          type: "string",
        },
        right: {
          description:
            "A math expression in plain text syntax, for example (x^2 - 9)/(x - 3).",
          type: "string",
        },
      },
      required: [],
      type: "object",
    });
  });
});
