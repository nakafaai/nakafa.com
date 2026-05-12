import {
  createEffectSchema,
  providerCompatibleObjectSchema,
} from "@repo/ai/lib/effect-schema";
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

  it("uses custom model metadata without weakening Effect validation", async () => {
    const inputSchema = createEffectSchema(
      Schema.Struct({
        expression: Schema.String,
      }),
      {
        anyOf: [
          {
            properties: {
              expression: { type: "string" },
            },
            required: ["expression"],
            type: "object",
          },
        ],
        type: "object",
      }
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Effect tool input schema must validate model input.");
    }

    expect(jsonSchema).toMatchObject({
      anyOf: [
        {
          properties: {
            expression: { type: "string" },
          },
          required: ["expression"],
          type: "object",
        },
      ],
      type: "object",
    });

    await expect(Promise.resolve(validate({}))).resolves.toMatchObject({
      success: false,
    });
  });

  it("adapts Effect union schemas for provider-compatible tool parameters", async () => {
    const expressionSchema = Schema.Struct({
      expression: Schema.String.annotations({
        description: "Expression to simplify.",
      }),
      operation: Schema.Literal("simplify").annotations({
        description: "Simplify one expression.",
      }),
    }).pipe(Schema.mutable);

    const compareSchema = Schema.Struct({
      left: Schema.String.annotations({
        description: "Left side to compare.",
      }),
      operation: Schema.Literal("compare").annotations({
        description: "Compare two expressions.",
      }),
      right: Schema.String.annotations({
        description: "Right side to compare.",
      }),
    }).pipe(Schema.mutable);

    const groupedSchema = Schema.Union(expressionSchema, compareSchema)
      .pipe(Schema.mutable)
      .annotations({
        description: "Grouped math input.",
      });

    const inputSchema = createEffectSchema(
      groupedSchema,
      providerCompatibleObjectSchema(groupedSchema)
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);
    const validate = schema.validate;

    if (!validate) {
      throw new Error("Effect tool input schema must validate model input.");
    }

    expect(jsonSchema).not.toHaveProperty("anyOf");
    expect(jsonSchema).toMatchObject({
      description: "Grouped math input.",
      properties: {
        expression: {
          description: "Expression to simplify.",
          type: "string",
        },
        left: {
          description: "Left side to compare.",
          type: "string",
        },
        operation: {
          enum: ["simplify", "compare"],
          type: "string",
        },
        right: {
          description: "Right side to compare.",
          type: "string",
        },
      },
      required: [],
      type: "object",
    });

    await expect(
      Promise.resolve(
        validate({
          operation: "simplify",
        })
      )
    ).resolves.toMatchObject({ success: false });

    await expect(
      Promise.resolve(
        validate({
          expression: "x + x",
          operation: "simplify",
        })
      )
    ).resolves.toEqual({
      success: true,
      value: {
        expression: "x + x",
        operation: "simplify",
      },
    });
  });

  it("keeps fallback descriptions when merging repeated union fields", async () => {
    const leftSchema = Schema.Struct({
      operation: Schema.Literal("left"),
      value: Schema.String,
    }).pipe(Schema.mutable);

    const rightSchema = Schema.Struct({
      operation: Schema.Literal("right").annotations({
        description: "Choose the right branch.",
      }),
      value: Schema.String.annotations({
        description: "Shared value.",
      }),
    }).pipe(Schema.mutable);

    const inputSchema = createEffectSchema(
      Schema.Union(leftSchema, rightSchema).pipe(Schema.mutable),
      providerCompatibleObjectSchema(
        Schema.Union(leftSchema, rightSchema).pipe(Schema.mutable)
      )
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    expect(jsonSchema).toMatchObject({
      properties: {
        operation: {
          description: "Choose the right branch.",
          enum: ["left", "right"],
        },
        value: {
          description: "Shared value.",
          type: "string",
        },
      },
    });
  });

  it("combines branch descriptions and relaxes shared array bounds", async () => {
    const twoValues = Schema.Array(Schema.String)
      .pipe(Schema.itemsCount(2), Schema.mutable)
      .annotations({
        description: "Exactly two values.",
      });

    const fourValues = Schema.Array(Schema.String)
      .pipe(Schema.itemsCount(4), Schema.mutable)
      .annotations({
        description: "Exactly four values.",
      });

    const groupedSchema = Schema.Union(
      Schema.Struct({
        operation: Schema.Literal("two"),
        values: twoValues,
      }).pipe(Schema.mutable),
      Schema.Struct({
        operation: Schema.Literal("four"),
        values: fourValues,
      }).pipe(Schema.mutable)
    ).pipe(Schema.mutable);

    const inputSchema = createEffectSchema(
      groupedSchema,
      providerCompatibleObjectSchema(groupedSchema)
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    expect(jsonSchema).toMatchObject({
      properties: {
        values: {
          description: "Exactly two values. Exactly four values.",
          maxItems: 4,
          minItems: 2,
          type: "array",
        },
      },
    });
  });

  it("merges shared arrays without optional descriptions or symmetric bounds", async () => {
    const unboundedValues = Schema.Array(Schema.String).pipe(Schema.mutable);
    const boundedValues = Schema.Array(Schema.String).pipe(
      Schema.minItems(1),
      Schema.maxItems(3),
      Schema.mutable
    );

    const groupedSchema = Schema.Union(
      Schema.Struct({
        operation: Schema.Literal("unbounded"),
        values: unboundedValues,
      }).pipe(Schema.mutable),
      Schema.Struct({
        operation: Schema.Literal("bounded"),
        values: boundedValues,
      }).pipe(Schema.mutable)
    ).pipe(Schema.mutable);

    const inputSchema = createEffectSchema(
      groupedSchema,
      providerCompatibleObjectSchema(groupedSchema)
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    if (!("properties" in jsonSchema && jsonSchema.properties)) {
      throw new Error("Grouped schema must expose object properties.");
    }

    const { properties } = jsonSchema;

    expect(jsonSchema).toMatchObject({
      properties: {
        values: {
          minItems: 0,
          type: "array",
        },
      },
    });
    expect(properties.values).toHaveProperty(
      "description",
      "an array of at most 3 item(s)"
    );
    expect(properties.values).not.toHaveProperty("maxItems");
  });

  it("keeps shared unconstrained arrays valid when no descriptions exist", async () => {
    const groupedSchema = Schema.Union(
      Schema.Struct({
        operation: Schema.Literal("left"),
        values: Schema.Array(Schema.String).pipe(Schema.mutable),
      }).pipe(Schema.mutable),
      Schema.Struct({
        operation: Schema.Literal("right"),
        values: Schema.Array(Schema.String).pipe(Schema.mutable),
      }).pipe(Schema.mutable)
    ).pipe(Schema.mutable);

    const inputSchema = createEffectSchema(
      groupedSchema,
      providerCompatibleObjectSchema(groupedSchema)
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    if (!("properties" in jsonSchema && jsonSchema.properties)) {
      throw new Error("Grouped schema must expose object properties.");
    }

    const { properties } = jsonSchema;

    expect(jsonSchema).toMatchObject({
      properties: {
        values: {
          type: "array",
        },
      },
    });
    expect(properties.values).not.toHaveProperty("description");
  });

  it("keeps shared array bounds valid when the bounded branch comes first", async () => {
    const groupedSchema = Schema.Union(
      Schema.Struct({
        operation: Schema.Literal("bounded"),
        values: Schema.Array(Schema.String).pipe(
          Schema.minItems(1),
          Schema.mutable
        ),
      }).pipe(Schema.mutable),
      Schema.Struct({
        operation: Schema.Literal("unbounded"),
        values: Schema.Array(Schema.String).pipe(Schema.mutable),
      }).pipe(Schema.mutable)
    ).pipe(Schema.mutable);

    const inputSchema = createEffectSchema(
      groupedSchema,
      providerCompatibleObjectSchema(groupedSchema)
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    expect(jsonSchema).toMatchObject({
      properties: {
        values: {
          minItems: 0,
          type: "array",
        },
      },
    });
  });

  it("keeps undecorated repeated fields valid when no description exists", async () => {
    const leftSchema = Schema.Struct({
      operation: Schema.Literal("left"),
      value: Schema.String,
    }).pipe(Schema.mutable);

    const rightSchema = Schema.Struct({
      operation: Schema.Literal("right"),
      value: Schema.String,
    }).pipe(Schema.mutable);

    const groupedSchema = Schema.Union(leftSchema, rightSchema).pipe(
      Schema.mutable
    );
    const inputSchema = createEffectSchema(
      groupedSchema,
      providerCompatibleObjectSchema(groupedSchema)
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    expect(jsonSchema).toMatchObject({
      properties: {
        operation: {
          enum: ["left", "right"],
        },
        value: {
          type: "string",
        },
      },
    });
  });

  it("keeps already object-shaped schemas unchanged for model metadata", async () => {
    const objectSchema = Schema.Struct({
      query: Schema.String.annotations({
        description: "Query text.",
      }),
    }).annotations({
      description: "Object input.",
    });

    const inputSchema = createEffectSchema(
      objectSchema,
      providerCompatibleObjectSchema(objectSchema)
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    expect(jsonSchema).toMatchObject({
      description: "Object input.",
      properties: {
        query: {
          description: "Query text.",
          type: "string",
        },
      },
      required: ["query"],
      type: "object",
    });
  });

  it("falls back to an empty object schema for non-object model metadata", async () => {
    const inputSchema = createEffectSchema(
      Schema.String,
      providerCompatibleObjectSchema(Schema.String)
    );

    const schema = asSchema(inputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);

    expect(jsonSchema).toMatchObject({
      properties: {},
      required: [],
      type: "object",
    });
  });
});
