import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Cause, Effect, Schema } from "effect";

type AgentToolError = NakafaAgentDataReadError | NakafaAgentInputError;

const McpToolErrorStructuredContentSchema = Schema.Struct({
  error: Schema.Struct({
    message: Schema.String,
    suggestions: Schema.Array(Schema.String).pipe(
      Schema.check(Schema.isMinLength(1))
    ),
  }),
});

/** Advertises both successful structured content and actionable tool errors. */
export function mcpToolOutputSchema<Success extends Schema.Constraint>(
  success: Success
) {
  return Schema.Union([success, McpToolErrorStructuredContentSchema]);
}

/** Runs one Effect program at the MCP tool callback boundary. */
export function runMcpTool<Output extends Readonly<Record<string, unknown>>>(
  program: Effect.Effect<Output, AgentToolError>,
  requestId: string
) {
  return Effect.runPromise(
    program.pipe(
      Effect.matchCauseEffect({
        onFailure: (cause) => {
          const failure = cause.reasons.find(Cause.isFailReason);
          if (failure) {
            return Effect.succeed(toExpectedToolError(failure.error));
          }
          return Effect.logError(
            "Unexpected Nakafa MCP tool failure.",
            cause
          ).pipe(
            Effect.annotateLogs({ requestId }),
            Effect.as(
              toMcpToolError("Nakafa MCP could not complete this request.", [
                `Retry later and include request ID ${requestId} with support.`,
              ])
            )
          );
        },
        onSuccess: (output) =>
          Effect.succeed({
            content: [{ text: JSON.stringify(output), type: "text" as const }],
            structuredContent: output,
          }),
      })
    )
  );
}

/** Builds the established structured MCP tool error shape. */
export function toMcpToolError(
  message: string,
  suggestions: readonly [string, ...string[]]
) {
  const structuredContent = {
    error: {
      message,
      suggestions: [...suggestions],
    },
  };
  return {
    content: [
      {
        text: JSON.stringify(structuredContent),
        type: "text" as const,
      },
    ],
    isError: true as const,
    structuredContent,
  };
}

/** Maps one expected domain failure to actionable public guidance. */
function toExpectedToolError(error: AgentToolError) {
  if (error._tag === "NakafaAgentInputError") {
    return toMcpToolError(error.message, [
      error.cause ??
        "Correct the tool arguments using the published input schema and retry.",
    ]);
  }
  return toMcpToolError(error.message, [
    "Retry later using the same documented arguments.",
  ]);
}
