import { Nakafa } from "@repo/ai/agents/nakafa/service";
import {
  NakafaAgentExerciseOptionsSchema,
  NakafaAgentExerciseResultSchema,
} from "@repo/contents/_lib/agent/schema/exercise";
import { Effect, Option } from "effect";
import { decodeNakafaMcpToolInput } from "@/lib/mcp/effect";
import { nakafaContent } from "@/lib/mcp/nakafa";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";

export const NakafaGetExerciseToolInputSchema =
  NakafaAgentExerciseOptionsSchema;
export const NakafaGetExerciseToolOutputSchema =
  NakafaAgentExerciseResultSchema;

/** Builds an exercise tool result for one set or question reference. */
export function getNakafaExerciseToolResult(args: unknown) {
  return Effect.gen(function* () {
    const input = yield* decodeNakafaMcpToolInput(
      NakafaGetExerciseToolInputSchema,
      args,
      "Invalid Nakafa exercise read options."
    );
    const exercise = yield* Nakafa.exercise(
      input.content_ref,
      input.exercise_number
    ).pipe(Effect.provideService(Nakafa, nakafaContent));

    return Option.match(exercise, {
      onNone: () =>
        toMcpToolError("Nakafa exercise content was not found.", [
          'Call `nakafa_search_content` with `section: "material"` and reuse the returned `content_id` as `content_ref`.',
          "If requesting one question, verify `exercise_number` exists in the exercise set.",
        ]),
      onSome: toMcpStructuredResult,
    });
  }).pipe(
    Effect.catchTags({
      NakafaAgentDataReadError: succeedMcpReadModelError,
      NakafaAgentInputError: succeedMcpReadModelError,
    })
  );
}
