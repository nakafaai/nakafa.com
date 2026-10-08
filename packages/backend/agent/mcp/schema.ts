import { Schema } from "effect";
import { McpSchema } from "effect/ai";

/** One object-rooted Effect contract whose JSON Schema an MCP tool advertises. */
export type McpObjectContract = Schema.ConstraintCodec<
  object,
  object,
  unknown,
  unknown
>;

/** Exposes one object-rooted Effect contract as an MCP tool input schema. */
export function toMcpInputSchema(source: McpObjectContract) {
  const document = Schema.toJsonSchemaDocument(source);
  return Schema.decodeUnknownEffect(McpSchema.ToolJson)({
    $defs: document.definitions,
    ...document.schema,
    type: "object",
  });
}

/** Exposes one object-rooted Effect contract as an MCP tool output schema. */
export function toMcpOutputSchema(source: McpObjectContract) {
  const document = Schema.toJsonSchemaDocument(source);
  return Schema.decodeUnknownEffect(McpSchema.ToolOutputJson)({
    $defs: document.definitions,
    ...document.schema,
    type: "object",
  });
}
