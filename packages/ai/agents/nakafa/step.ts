import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";
import type { ModelMessage } from "ai";
import { Option } from "effect";

const exerciseActiveTools = ["exercise"] satisfies "exercise"[];
const exerciseToolChoice = {
  toolName: "exercise",
  type: "tool",
} satisfies { toolName: "exercise"; type: "tool" };

/**
 * Selects the exercise reference to read after an exercise-scoped search.
 * This is based on tool input and search output, not user-query regex.
 */
export function selectExerciseRef(
  input: NakafaAgentSearchInput,
  result: NakafaAgentSearchResult | null
) {
  if (result === null) {
    return Option.none();
  }

  if (input.section !== "exercises") {
    return Option.none();
  }

  const item = result.items.find((item) => item.section === "exercises");

  if (!item) {
    return Option.none();
  }

  return Option.some(item.content_id);
}

/**
 * Builds the AI SDK step override that completes search -> exercise retrieval.
 */
export function prepareExerciseStep(
  ref: Option.Option<string>,
  messages: ModelMessage[],
  hasExerciseToolCall: boolean
) {
  if (Option.isNone(ref)) {
    return;
  }

  if (hasExerciseToolCall) {
    return;
  }

  const input = JSON.stringify({
    content_ref: ref.value,
  });
  const message = {
    role: "user",
    content: `Call the exercise tool now with this exact input and wait for the result before answering.\n\n${input}\n\nDo not call search again for this exercise.`,
  } satisfies ModelMessage;

  return {
    activeTools: exerciseActiveTools,
    messages: [...messages, message],
    toolChoice: exerciseToolChoice,
  };
}
