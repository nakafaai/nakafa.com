import {
  createEffectSchema,
  providerCompatibleObjectSchema,
} from "@repo/ai/lib/effect-schema";
import { asSchema } from "ai";
import { type JsonSchema, Schema, Struct } from "effect";
import { describe, expect, it } from "vitest";

/** Builds one controlled generated JSON Schema for adapter edge cases. */
function jsonSchemaFixture(jsonSchema: JsonSchema.JsonSchema) {
  return Schema.Any.pipe(
    Schema.check(
      Schema.makeFilter(() => true, {
        toJsonSchema: () => jsonSchema,
      })
    )
  );
}

describe("createEffectSchema", () => {
  it("keeps Effect descriptions in AI SDK JSON Schema", async () => {
    const inputSchema = createEffectSchema(
      Schema.Struct({
        query: Schema.String.annotate({
          description: "Search query for the model to generate.",
        }),
      }).annotate({ description: "Search tool input." })
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
      expression: Schema.String.annotate({
        description: "Expression to simplify.",
      }),
      operation: Schema.Literal("simplify").annotate({
        description: "Simplify one expression.",
      }),
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
    const compareSchema = Schema.Struct({
      left: Schema.String.annotate({
        description: "Left side to compare.",
      }),
      operation: Schema.Literal("compare").annotate({
        description: "Compare two expressions.",
      }),
      right: Schema.String.annotate({
        description: "Right side to compare.",
      }),
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
    const groupedSchema = Schema.Union([
      expressionSchema,
      compareSchema,
    ]).annotate({
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
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
    const rightSchema = Schema.Struct({
      operation: Schema.Literal("right").annotate({
        description: "Choose the right branch.",
      }),
      value: Schema.String.annotate({
        description: "Shared value.",
      }),
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
    const inputSchema = createEffectSchema(
      Schema.Union([leftSchema, rightSchema]),
      providerCompatibleObjectSchema(Schema.Union([leftSchema, rightSchema]))
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
  it("resolves generated local references before merging union fields", () => {
    const SharedValueSchema = Schema.Literals(["first", "second"]).annotate({
      identifier: "SharedValue",
    });
    const groupedSchema = Schema.Union([
      Schema.Struct({
        operation: Schema.Literal("left"),
        value: SharedValueSchema,
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
      Schema.Struct({
        operation: Schema.Literal("right"),
        value: SharedValueSchema,
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
    ]);
    const modelSchema = providerCompatibleObjectSchema(groupedSchema);
    expect(modelSchema).toMatchObject({
      definitions: {
        SharedValue: {
          enum: ["first", "second"],
        },
      },
      properties: {
        value: {
          enum: ["first", "second"],
        },
      },
    });
  });
  it("combines branch descriptions and relaxes shared array bounds", async () => {
    const twoValues = Schema.Array(Schema.String)
      .pipe(Schema.mutable, Schema.check(Schema.isLengthBetween(2, 2)))
      .annotate({
        description: "Exactly two values.",
      });
    const fourValues = Schema.Array(Schema.String)
      .pipe(Schema.mutable, Schema.check(Schema.isLengthBetween(4, 4)))
      .annotate({
        description: "Exactly four values.",
      });
    const groupedSchema = Schema.Union([
      Schema.Struct({
        operation: Schema.Literal("two"),
        values: twoValues,
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
      Schema.Struct({
        operation: Schema.Literal("four"),
        values: fourValues,
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
    ]);
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
      Schema.mutable,
      Schema.check(Schema.isMinLength(1)),
      Schema.check(Schema.isMaxLength(3))
    );
    const groupedSchema = Schema.Union([
      Schema.Struct({
        operation: Schema.Literal("unbounded"),
        values: unboundedValues,
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
      Schema.Struct({
        operation: Schema.Literal("bounded"),
        values: boundedValues,
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
    ]);
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
    const groupedSchema = Schema.Union([
      Schema.Struct({
        operation: Schema.Literal("left"),
        values: Schema.Array(Schema.String).pipe(Schema.mutable),
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
      Schema.Struct({
        operation: Schema.Literal("right"),
        values: Schema.Array(Schema.String).pipe(Schema.mutable),
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
    ]);
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
    const groupedSchema = Schema.Union([
      Schema.Struct({
        operation: Schema.Literal("bounded"),
        values: Schema.Array(Schema.String).pipe(
          Schema.mutable,
          Schema.check(Schema.isMinLength(1))
        ),
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
      Schema.Struct({
        operation: Schema.Literal("unbounded"),
        values: Schema.Array(Schema.String).pipe(Schema.mutable),
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
    ]);
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
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
    const rightSchema = Schema.Struct({
      operation: Schema.Literal("right"),
      value: Schema.String,
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
    const groupedSchema = Schema.Union([leftSchema, rightSchema]);
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
      query: Schema.String.annotate({
        description: "Query text.",
      }),
    }).annotate({
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
  it("filters non-object union metadata before building provider properties", () => {
    const modelSchema = providerCompatibleObjectSchema(
      Schema.Union([
        jsonSchemaFixture({ required: [], type: "object" }),
        jsonSchemaFixture({
          properties: { value: { type: "string" } },
          required: ["value"],
          type: "object",
        }),
      ])
    );
    expect(modelSchema).toMatchObject({
      properties: { value: { type: "string" } },
    });
  });
  it("ignores invalid array intersections while retaining branch guidance", () => {
    const modelSchema = providerCompatibleObjectSchema(
      Schema.Union([
        jsonSchemaFixture({
          properties: {
            values: {
              allOf: [false, { maxItems: 3 }],
              type: "array",
            },
          },
          required: ["values"],
          type: "object",
        }),
        jsonSchemaFixture({
          properties: { values: { type: "array" } },
          required: ["values"],
          type: "object",
        }),
      ])
    );
    expect(modelSchema).toMatchObject({
      properties: {
        values: {
          description: "an array of at most 3 item(s)",
          type: "array",
        },
      },
    });
  });
  it("rejects unsupported generated property schemas", () => {
    expect(() =>
      providerCompatibleObjectSchema(
        Schema.Union([
          jsonSchemaFixture({
            properties: { value: true },
            required: ["value"],
            type: "object",
          }),
          jsonSchemaFixture({
            properties: { value: { type: "string" } },
            required: ["value"],
            type: "object",
          }),
        ])
      )
    ).toThrow("Effect generated an unsupported schema for property value.");
  });
  it("rejects non-object model metadata", () => {
    expect(() => providerCompatibleObjectSchema(Schema.String)).toThrow(
      "Provider-compatible tool schemas require an object or object union."
    );
  });
});
