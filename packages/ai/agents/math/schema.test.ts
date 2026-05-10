import { mathArithmeticInput } from "@repo/ai/agents/math/schema";
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
});
