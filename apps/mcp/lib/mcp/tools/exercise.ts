import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getNakafaAgentExercise } from "@repo/contents/_lib/agent/exercises";
import { Effect, Option } from "effect";
import {
  toMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";
import {
  NakafaGetExerciseInputSchema,
  NakafaGetExerciseOutputSchema,
} from "@/lib/mcp/schemas";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";

/** Registers the structured exercise retrieval tool. */
export function registerNakafaGetExerciseTool(server: McpServer) {
  server.registerTool(
    "nakafa_get_exercise",
    {
      annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
      description:
        "Return structured Nakafa exercise questions, choices, answers, explanations, URLs, and metadata for an exercise content reference.",
      inputSchema: NakafaGetExerciseInputSchema,
      outputSchema: NakafaGetExerciseOutputSchema,
      title: "Get Nakafa Exercise",
    },
    ({ content_ref, exercise_number }) =>
      Effect.runPromise(
        getNakafaAgentExercise(content_ref, exercise_number).pipe(
          Effect.map(
            Option.match({
              onNone: () =>
                toMcpToolError("Nakafa exercise content was not found.", [
                  'Call `nakafa_search_content` with `section: "exercises"` and reuse the returned `content_id` as `content_ref`.',
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
