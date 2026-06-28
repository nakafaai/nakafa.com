import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeNakafaMcpToolInput,
  toMcpJsonObjectSchema,
  toMcpToolOutputJsonSchema,
  validateNakafaMcpToolResult,
} from "@/lib/mcp/effect";
import { toMcpStructuredResult, toMcpToolError } from "@/lib/mcp/result";

const ExampleInputSchema = Schema.Struct({
  name: Schema.Trim.pipe(Schema.minLength(1)),
}).pipe(Schema.mutable);

const ExampleOutputSchema = Schema.Struct({
  ok: Schema.Boolean,
}).pipe(Schema.mutable);

describe("Effect MCP schema helpers", () => {
  it("generates MCP object schemas and rejects non-object roots", () => {
    const inputSchema = toMcpJsonObjectSchema(ExampleInputSchema);
    const outputSchema = toMcpToolOutputJsonSchema(ExampleOutputSchema);

    expect(inputSchema.type).toBe("object");
    expect(Object.keys(inputSchema.properties)).toStrictEqual(["name"]);
    expect(outputSchema.anyOf).toHaveLength(2);
    expect(outputSchema.properties.error).toBeTruthy();
    expect(() => toMcpJsonObjectSchema(Schema.String)).toThrow(
      "MCP schemas must generate root object JSON Schema."
    );
  });

  it("decodes tool input strictly with Effect parse errors", async () => {
    const decoded = await Effect.runPromise(
      decodeNakafaMcpToolInput(ExampleInputSchema, { name: " nakafa " }, "Bad")
    );
    const invalid = await Effect.runPromise(
      Effect.flip(
        decodeNakafaMcpToolInput(
          ExampleInputSchema,
          { legacy: true, name: "nakafa" },
          "Bad"
        )
      )
    );

    expect(decoded).toStrictEqual({ name: "nakafa" });
    expect(invalid.cause).toContain("legacy");
  });

  it("maps missing required input to typed Effect failures", async () => {
    const invalid = await Effect.runPromise(
      Effect.flip(
        decodeNakafaMcpToolInput(ExampleInputSchema, {}, "Missing input.")
      )
    );

    expect(invalid.message).toBe("Missing input.");
    expect(invalid.cause).toContain("name");
  });

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
