import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  getUnknownErrorMessage,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Effect, type JsonSchema, Result, Schema } from "effect";
import {
  NakafaMcpToolErrorSchema,
  NakafaMcpToolErrorStructuredContentSchema,
  toMcpToolError,
} from "@/lib/mcp/result";
export type NakafaMcpSchema = Schema.ConstraintDecoder<unknown, never>;
interface McpJsonObjectSchema extends JsonSchema.JsonSchema {
  readonly $defs?: JsonSchema.Definitions;
  readonly properties: Record<string, JsonSchema.JsonSchema>;
  readonly required: string[];
  readonly type: "object";
}
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
export function toMcpJsonObjectSchema(
  schema: NakafaMcpSchema
): McpJsonObjectSchema {
  const document = Schema.toJsonSchemaDocument(schema);
  const jsonSchema =
    Object.keys(document.definitions).length === 0
      ? document.schema
      : { ...document.schema, $defs: document.definitions };
  if (jsonSchema.type !== "object") {
    throw new Error("MCP schemas must generate root object JSON Schema.");
  }
  const properties = readJsonSchemaProperties(jsonSchema.properties);
  const required = readRequiredProperties(jsonSchema.required);
  return {
    ...jsonSchema,
    properties,
    required,
    type: "object",
  };
}
/** Builds an MCP output schema that accepts success content or tool errors. */
export function toMcpToolOutputJsonSchema(schema: NakafaMcpSchema) {
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
      error: withoutRootJsonSchemaMetadata(errorProperty),
    },
    required: [],
  };
}
/** Decodes untrusted MCP tool input with the provided Effect schema. */
export function decodeNakafaMcpToolInput<TSchema extends NakafaMcpSchema>(
  schema: TSchema,
  input: unknown,
  message: string
) {
  return Schema.decodeUnknownEffect(
    schema,
    MCP_PARSE_OPTIONS
  )(input).pipe(
    Effect.mapError(
      (error) =>
        new NakafaAgentInputError({
          cause: getUnknownErrorMessage(error),
          message,
        })
    )
  );
}
/** Validates successful structured tool output against its Effect schema. */
export function validateNakafaMcpToolResult(
  result: CallToolResult,
  schema: NakafaMcpSchema,
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
  const decoded = Schema.decodeResult(
    schema,
    MCP_PARSE_OPTIONS
  )(result.structuredContent);
  if (Result.isSuccess(decoded)) {
    return result;
  }
  return toMcpToolError("Nakafa MCP tool returned invalid output.", [
    decoded.failure.message,
  ]);
}
/** Reads generated JSON Schema properties without trusting an open record. */
function readJsonSchemaProperties(value: unknown) {
  if (value === undefined) {
    return {};
  }
  if (!isJsonSchemaRecord(value)) {
    throw new Error("MCP object schemas must contain JSON Schema properties.");
  }
  return value;
}
/** Reads generated required properties without trusting an open record. */
function readRequiredProperties(value: unknown) {
  if (value === undefined) {
    return [];
  }
  if (
    !(Array.isArray(value) && value.every((item) => typeof item === "string"))
  ) {
    throw new Error(
      "MCP object schemas must contain string required properties."
    );
  }
  return value;
}
/** Narrows one open JSON Schema property map. */
function isJsonSchemaRecord(
  value: unknown
): value is Record<string, JsonSchema.JsonSchema> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (property) =>
      typeof property === "object" &&
      property !== null &&
      !Array.isArray(property)
  );
}
/** Removes root-only JSON Schema metadata before nesting schema branches. */
function withoutRootJsonSchemaMetadata(schema: McpJsonObjectSchema) {
  const { $defs: _definitions, $schema: _schema, ...branch } = schema;
  return branch;
}
