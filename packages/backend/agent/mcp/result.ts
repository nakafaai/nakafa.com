import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";

type AgentToolError = NakafaAgentDataReadError | NakafaAgentInputError;

/** Runs an Effect program at one MCP tool callback boundary. */
export function runMcpTool<Output extends Readonly<Record<string, unknown>>>(
  program: Effect.Effect<Output, AgentToolError>
) {
  return Effect.runPromise(
    program.pipe(
      Effect.match({
        onFailure: (error) => ({
          content: [
            {
              text: JSON.stringify({
                code:
                  error._tag === "NakafaAgentInputError"
                    ? "INVALID_ARGUMENTS"
                    : "CONTENT_UNAVAILABLE",
                message: error.message,
                resolution:
                  error._tag === "NakafaAgentInputError"
                    ? "Correct the tool arguments and retry."
                    : "Retry later using the same documented arguments.",
              }),
              type: "text" as const,
            },
          ],
          isError: true,
        }),
        onSuccess: (output) => ({
          content: [{ text: JSON.stringify(output), type: "text" as const }],
          structuredContent: output,
        }),
      })
    )
  );
}
