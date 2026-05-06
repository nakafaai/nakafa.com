import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";

/** Converts structured content into a modern MCP tool result. */
export function toMcpStructuredResult<
  TStructuredContent extends Record<string, unknown>,
>(structuredContent: TStructuredContent) {
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
export function toMcpToolError(message: string, suggestions: string[]) {
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
