import { createEffectSchema } from "@repo/ai/lib/effect-schema";
import { asSchema } from "ai";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("createEffectSchema", () => {
  it("keeps Effect descriptions in AI SDK JSON Schema", async () => {
    const inputSchema = createEffectSchema(
      Schema.Struct({
        query: Schema.String.annotations({
          description: "Search query for the model to generate.",
        }),
      }).annotations({ description: "Search tool input." })
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Effect tool input schema must validate model input.");
    }

    expect(jsonSchema).toMatchObject({
      description: "Search tool input.",
      properties: {
        query: {
          description: "Search query for the model to generate.",
          type: "string",
        },
      },
      required: ["query"],
      type: "object",
    });

    await expect(
      Promise.resolve(validate({ query: "fungsi rasional" }))
    ).resolves.toEqual({
      success: true,
      value: { query: "fungsi rasional" },
    });

    await expect(Promise.resolve(validate({ query: 123 }))).resolves.toEqual(
      expect.objectContaining({ success: false })
    );
  });
});
