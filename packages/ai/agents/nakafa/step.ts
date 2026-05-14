import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";
import type { ModelMessage } from "ai";
import { Option } from "effect";

const exerciseActiveTools = ["exercise"] satisfies "exercise"[];
const readActiveTools = ["read"] satisfies "read"[];
const exerciseToolChoice = {
  toolName: "exercise",
  type: "tool",
} satisfies { toolName: "exercise"; type: "tool" };
const readToolChoice = {
  toolName: "read",
  type: "tool",
} satisfies { toolName: "read"; type: "tool" };
const answerToolChoice = "none" as const;
const maxDiscoverySearchCalls = 4;

interface ToolStep {
  toolCalls: readonly {
    toolName: string;
  }[];
}

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
    messages: [message],
    toolChoice: exerciseToolChoice,
  };
}

/**
 * Detects search results that need a full content read before Nina answers.
 */
export function shouldReadAfterSearch(
  input: NakafaAgentSearchInput,
  result: NakafaAgentSearchResult | null
) {
  if (result === null) {
    return false;
  }

  if (input.section === "exercises" || input.section === "quran") {
    return false;
  }

  return result.items.some(
    (item) => item.section === "articles" || item.section === "subject"
  );
}

/**
 * Builds the AI SDK step override that completes discovery -> content read.
 */
export function prepareReadStep(
  hasPendingRead: boolean,
  messages: ModelMessage[],
  hasReadToolCall: boolean
) {
  if (!hasPendingRead) {
    return;
  }

  if (hasReadToolCall) {
    return;
  }

  const message = {
    role: "user",
    content:
      "Call the read tool now with the single most relevant content_id from the Nakafa search results already in this conversation. Use that full content before answering. Do not call search again before reading.",
  } satisfies ModelMessage;

  return {
    activeTools: readActiveTools,
    messages: [...messages, message],
    toolChoice: readToolChoice,
  };
}

/**
 * Detects when the content agent has enough retrieval evidence and should stop
 * searching instead of spending the remaining loop budget on repeated discovery.
 */
export function shouldAnswerFromNakafaEvidence(steps: readonly ToolStep[]) {
  const searchCalls = steps.flatMap((step) =>
    step.toolCalls.filter((toolCall) => toolCall.toolName === "search")
  );

  return searchCalls.length >= maxDiscoverySearchCalls;
}

/**
 * Builds the AI SDK step override that turns off tools and asks the model to
 * answer from the Nakafa evidence already present in the conversation.
 */
export function prepareAnswerFromNakafaEvidenceStep(
  messages: ModelMessage[],
  steps: readonly ToolStep[]
) {
  if (!shouldAnswerFromNakafaEvidence(steps)) {
    return;
  }

  const message = {
    role: "user",
    content:
      "Use the Nakafa tool results already in this conversation. Do not call another Nakafa tool. Write the final source-backed answer now. If a requested item is still missing, say that Nakafa did not return enough data for that item.",
  } satisfies ModelMessage;

  return {
    messages: [...messages, message],
    toolChoice: answerToolChoice,
  };
}
