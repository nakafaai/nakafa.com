import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  getUnknownErrorMessage,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Effect, Either, JSONSchema, Schema } from "effect";
import {
  NakafaMcpToolErrorSchema,
  NakafaMcpToolErrorStructuredContentSchema,
  toMcpToolError,
} from "@/lib/mcp/result";

type McpJsonObjectSchema = JSONSchema.JsonSchema7Object &
  Pick<JSONSchema.JsonSchema7Root, "$defs" | "$schema">;

const MCP_PARSE_OPTIONS = {
  onExcessProperty: "error",
} as const;

/**
 * Converts an Effect object schema to the JSON Schema shape required by MCP.
 *
 * References:
 * - https://effect.website/docs/schema/json-schema/
 * - https://modelcontextprotocol.io/specification/2025-06-18/server/tools
 */
export function toMcpJsonObjectSchema(schema: Schema.Schema.AnyNoContext) {
  const jsonSchema = JSONSchema.make(schema);

  if (isMcpJsonObjectSchema(jsonSchema)) {
    return jsonSchema;
  }

  throw new Error("MCP schemas must generate root object JSON Schema.");
}

/** Builds an MCP output schema that accepts success content or tool errors. */
export function toMcpToolOutputJsonSchema(schema: Schema.Schema.AnyNoContext) {
  const successSchema = toMcpJsonObjectSchema(schema);
  const errorSchema = toMcpJsonObjectSchema(
    NakafaMcpToolErrorStructuredContentSchema
  );
  const errorProperty = toMcpJsonObjectSchema(NakafaMcpToolErrorSchema);

  return {
    ...successSchema,
    additionalProperties: false,
    anyOf: [
      withoutRootJsonSchemaMetadata(successSchema),
      withoutRootJsonSchemaMetadata(errorSchema),
    ],
    properties: {
      ...successSchema.properties,
      error: errorProperty,
    },
    required: [],
  };
}

/** Decodes untrusted MCP tool input with the provided Effect schema. */
export function decodeNakafaMcpToolInput<
  TSchema extends Schema.Schema.AnyNoContext,
>(schema: TSchema, input: unknown, message: string) {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(schema, MCP_PARSE_OPTIONS)(input),
    catch: (error) =>
      new NakafaAgentInputError({
        cause: getUnknownErrorMessage(error),
        message,
      }),
  });
}

/** Validates successful structured tool output against its Effect schema. */
export function validateNakafaMcpToolResult(
  result: CallToolResult,
  schema: Schema.Schema.AnyNoContext,
  toolName: string
) {
  if (result.isError) {
    return result;
  }

  if (!result.structuredContent) {
    return toMcpToolError("Nakafa MCP tool returned invalid output.", [
      `Tool ${toolName} returned no structuredContent.`,
    ]);
  }

  const decoded = Schema.decodeUnknownEither(
    schema,
    MCP_PARSE_OPTIONS
  )(result.structuredContent);

  if (Either.isRight(decoded)) {
    return result;
  }

  return toMcpToolError("Nakafa MCP tool returned invalid output.", [
    decoded.left.message,
  ]);
}

/** Checks whether generated JSON Schema satisfies MCP's object-root contract. */
function isMcpJsonObjectSchema(
  schema: JSONSchema.JsonSchema7Root
): schema is McpJsonObjectSchema {
  return "type" in schema && schema.type === "object";
}

/** Removes root-only JSON Schema metadata before nesting schema branches. */
function withoutRootJsonSchemaMetadata(schema: McpJsonObjectSchema) {
  const { $defs: _definitions, $schema: _schema, ...branch } = schema;

  return branch;
}
