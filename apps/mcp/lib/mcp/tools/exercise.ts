import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect, Option } from "effect";
import {
  succeedMcpReadModelError,
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
        getNakafaExerciseToolResult(content_ref, exercise_number)
      )
  );
}

/** Builds an exercise tool result for one set or question reference. */
export function getNakafaExerciseToolResult(
  contentRef: string,
  exerciseNumber?: number
) {
  return Nakafa.exercise(contentRef, exerciseNumber).pipe(
    Effect.provide(Nakafa.Default),
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
      NakafaAgentDataReadError: succeedMcpReadModelError,
    })
  );
}
