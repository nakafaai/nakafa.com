import { describe, expect, it } from "@repo/testing/effect";
import { Effect, type JsonSchema, Schema, Struct } from "effect";
import {
  decodeNakafaMcpToolInput,
  toMcpJsonObjectSchema,
  toMcpToolOutputJsonSchema,
  validateNakafaMcpToolResult,
} from "@/lib/mcp/effect";
import { toMcpStructuredResult, toMcpToolError } from "@/lib/mcp/result";

const ExampleInputSchema = Schema.Struct({
  name: Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const ExampleOutputSchema = Schema.Struct({
  ok: Schema.Boolean,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/** Builds a schema whose generated JSON Schema exercises MCP validation. */
function jsonSchemaFixture(jsonSchema: JsonSchema.JsonSchema) {
  return Schema.Any.pipe(
    Schema.check(
      Schema.makeFilter(() => true, {
        toJsonSchema: () => jsonSchema,
      })
    )
  );
}

describe("Effect MCP schema helpers", () => {
  it("generates MCP object schemas and rejects non-object roots", () => {
    const inputSchema = toMcpJsonObjectSchema(ExampleInputSchema);
    const outputSchema = toMcpToolOutputJsonSchema(ExampleOutputSchema);
    const ReferencedChildSchema = Schema.Struct({
      value: Schema.String,
    }).annotate({ identifier: "ReferencedChild" });
    const referencedSchema = toMcpJsonObjectSchema(
      Schema.Struct({ child: ReferencedChildSchema })
    );
    expect(inputSchema.type).toBe("object");
    expect(Object.keys(inputSchema.properties)).toStrictEqual(["name"]);
    expect(outputSchema.anyOf).toHaveLength(2);
    expect(outputSchema.properties.error).toBeTruthy();
    expect(referencedSchema.$defs?.ReferencedChild).toBeTruthy();
    expect(() => toMcpJsonObjectSchema(Schema.String)).toThrow(
      "MCP schemas must generate root object JSON Schema."
    );
  });
  it("rejects malformed generated object metadata", () => {
    expect(
      toMcpJsonObjectSchema(jsonSchemaFixture({ type: "object" }))
    ).toMatchObject({ properties: {}, required: [] });
    expect(() =>
      toMcpJsonObjectSchema(
        jsonSchemaFixture({ properties: [], type: "object" })
      )
    ).toThrow("MCP object schemas must contain JSON Schema properties.");
    expect(() =>
      toMcpJsonObjectSchema(
        jsonSchemaFixture({ properties: {}, required: [1], type: "object" })
      )
    ).toThrow("MCP object schemas must contain string required properties.");
  });
  it.effect("decodes tool input strictly with Effect parse errors", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeNakafaMcpToolInput(
        ExampleInputSchema,
        { name: " nakafa " },
        "Bad"
      );
      const invalid = yield* Effect.flip(
        decodeNakafaMcpToolInput(
          ExampleInputSchema,
          { legacy: true, name: "nakafa" },
          "Bad"
        )
      );
      expect(decoded).toStrictEqual({ name: "nakafa" });
      expect(invalid.cause).toContain("legacy");
    })
  );
  it.effect("maps missing required input to typed Effect failures", () =>
    Effect.gen(function* () {
      const invalid = yield* Effect.flip(
        decodeNakafaMcpToolInput(ExampleInputSchema, {}, "Missing input.")
      );
      expect(invalid.message).toBe("Missing input.");
      expect(invalid.cause).toContain("name");
    })
  );
  it("keeps errors and rejects malformed successful structured output", () => {
    const error = toMcpToolError("Missing.", ["Retry."]);
    const valid = toMcpStructuredResult({ ok: true });
    const missingStructuredContent = validateNakafaMcpToolResult(
      { content: [] },
      ExampleOutputSchema,
      "example"
    );
    const invalidStructuredContent = validateNakafaMcpToolResult(
      toMcpStructuredResult({ ok: "yes" }),
      ExampleOutputSchema,
      "example"
    );
    expect(
      validateNakafaMcpToolResult(error, ExampleOutputSchema, "example")
    ).toBe(error);
    expect(
      validateNakafaMcpToolResult(valid, ExampleOutputSchema, "example")
    ).toBe(valid);
    expect(missingStructuredContent.isError).toBe(true);
    expect(JSON.stringify(missingStructuredContent)).toContain(
      "no structuredContent"
    );
    expect(invalidStructuredContent.isError).toBe(true);
    expect(JSON.stringify(invalidStructuredContent)).toContain(
      "Expected boolean"
    );
  });
});
