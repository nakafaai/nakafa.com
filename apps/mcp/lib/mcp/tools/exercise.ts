import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getNakafaAgentExercise } from "@repo/contents/_lib/agent/exercises";
import { NakafaAgentExerciseResultSchema } from "@repo/contents/_lib/agent/schemas";
import { Effect, Option } from "effect";
import {
  toMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";
import { NakafaGetExerciseInputSchema } from "@/lib/mcp/schemas";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";

/** Registers the structured exercise retrieval tool. */
export function registerNakafaGetExerciseTool(server: McpServer) {
  server.registerTool(
    "nakafa_get_exercise",
    {
      annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
      description:
        "Return structured Nakafa exercise questions, choices, answers, explanations, URLs, and metadata for an exercise set or question.",
      inputSchema: NakafaGetExerciseInputSchema.shape,
      outputSchema: NakafaAgentExerciseResultSchema.shape,
      title: "Get Nakafa Exercise",
    },
    ({ content_id_or_url, exercise_number }) =>
      Effect.runPromise(
        getNakafaAgentExercise(content_id_or_url, exercise_number).pipe(
          Effect.map(
            Option.match({
              onNone: () =>
                toMcpToolError("Nakafa exercise content was not found.", [
                  'Call `nakafa_search_content` with `section: "exercises"` and reuse the returned `content_id`.',
                  "If requesting one question, verify `exercise_number` exists in the exercise set.",
                ]),
              onSome: toMcpStructuredResult,
            })
          ),
          Effect.catchTags({
            NakafaAgentDataReadError: (error) =>
              Effect.succeed(toMcpReadModelError(error)),
          })
        )
      )
  );
}
