import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Effect, Schema } from "effect";

type NakafaMcpStructuredResult<
  TStructuredContent extends Record<string, unknown>,
> = CallToolResult & {
  readonly structuredContent: TStructuredContent;
};

type NakafaMcpToolErrorResult = CallToolResult & {
  readonly isError: true;
  readonly structuredContent: {
    readonly error: {
      readonly message: string;
      readonly suggestions: string[];
    };
  };
};

/** Structured error payload shared by all MCP tool error results. */
export const NakafaMcpToolErrorSchema = Schema.Struct({
  message: Schema.String,
  suggestions: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.mutable
  ),
}).pipe(Schema.mutable);

/** Structured content schema shared by all MCP tool error results. */
export const NakafaMcpToolErrorStructuredContentSchema = Schema.Struct({
  error: NakafaMcpToolErrorSchema,
}).pipe(Schema.mutable);

/** Converts structured content into a modern MCP tool result. */
export function toMcpStructuredResult<
  TStructuredContent extends Record<string, unknown>,
>(
  structuredContent: TStructuredContent
): NakafaMcpStructuredResult<TStructuredContent> {
  return {
    content: [
      {
        text: JSON.stringify(structuredContent, null, 2),
        type: "text" as const,
      },
    ],
    structuredContent,
  };
}

/** Builds an actionable MCP tool execution error. */
export function toMcpToolError(
  message: string,
  suggestions: string[]
): NakafaMcpToolErrorResult {
  const structuredContent = {
    error: {
      message,
      suggestions,
    },
  };

  return {
    content: [
      {
        text: JSON.stringify(structuredContent, null, 2),
        type: "text" as const,
      },
    ],
    isError: true as const,
    structuredContent,
  };
}

/** Maps shared read-model failures to agent-friendly MCP tool errors. */
export function toMcpReadModelError(
  error: NakafaAgentInputError | NakafaAgentDataReadError
) {
  return toMcpToolError(error.message, [
    error.cause ??
      "Call `nakafa_get_taxonomy` and retry with supported values.",
  ]);
}

/** Lifts a typed read-model failure into a successful MCP error result. */
export function succeedMcpReadModelError(
  error: Parameters<typeof toMcpReadModelError>[0]
) {
  return Effect.succeed(toMcpReadModelError(error));
}
