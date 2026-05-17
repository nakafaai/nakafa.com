import { NAKAFA_AGENT_MAX_QUERIES } from "@repo/contents/_lib/agent/constants";
import { getNakafaExerciseSetRef } from "@repo/contents/_lib/agent/exercise/ref";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";
import type { ModelMessage } from "ai";
import { Option } from "effect";

interface ToolStep<ToolName extends string> {
  toolCalls: readonly {
    toolName: ToolName;
  }[];
}

/**
 * Selects the exercise reference to read after an exercise-scoped search.
 * Exact question numbers stay the model's responsibility through the
 * `exercise_number` tool input; this state machine only resolves the set ref.
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

  const items = result.items.filter((item) => item.section === "exercises");
  const firstItem = items.at(0);

  if (!firstItem) {
    return Option.none();
  }

  return getNakafaExerciseSetRef(firstItem.content_id).pipe(
    Option.map((ref) => ref.content_id)
  );
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
    content: `Call exactly one exercise tool with this content_ref and wait for the result before answering.\n\n${input}\n\nDo not call exercise with any other content_ref. Include exercise_number only when the original user asked for one specific question.`,
  } satisfies ModelMessage;

  return {
    activeTools: ["exercise" as const],
    messages: [...messages, message],
    toolChoice: { toolName: "exercise", type: "tool" } as const,
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
    activeTools: ["read" as const],
    messages: [...messages, message],
    toolChoice: { toolName: "read", type: "tool" } as const,
  };
}

/**
 * Stops taxonomy-only requests after the taxonomy evidence has been retrieved.
 */
export function prepareTaxonomyAnswerStep<const ToolName extends string>(
  messages: ModelMessage[],
  steps: readonly ToolStep<ToolName>[]
) {
  const hasTaxonomyToolCall = steps.some((step) =>
    step.toolCalls.some((toolCall) => toolCall.toolName === "taxonomy")
  );

  if (!hasTaxonomyToolCall) {
    return;
  }

  const hasOtherToolCall = steps.some((step) =>
    step.toolCalls.some((toolCall) => toolCall.toolName !== "taxonomy")
  );

  if (hasOtherToolCall) {
    return;
  }

  const message = {
    role: "user",
    content:
      "Use the Nakafa taxonomy result already in this conversation. Do not call another Nakafa tool. Answer only with supported sections, filters, categories, materials, grades, tools, or paths present in the taxonomy result.",
  } satisfies ModelMessage;

  return {
    messages: [...messages, message],
    toolChoice: "none" as const,
  };
}

/**
 * Detects when the content agent has enough retrieval evidence and should stop
 * searching instead of spending the remaining loop budget on repeated discovery.
 */
export function shouldAnswerFromNakafaEvidence<const ToolName extends string>(
  steps: readonly ToolStep<ToolName>[]
) {
  const searchCalls = steps.flatMap((step) =>
    step.toolCalls.filter((toolCall) => toolCall.toolName === "search")
  );

  return searchCalls.length >= NAKAFA_AGENT_MAX_QUERIES;
}

/**
 * Builds the AI SDK step override that turns off tools and asks the model to
 * answer from the Nakafa evidence already present in the conversation.
 */
export function prepareAnswerFromNakafaEvidenceStep<
  const ToolName extends string,
>(messages: ModelMessage[], steps: readonly ToolStep<ToolName>[]) {
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
    toolChoice: "none" as const,
  };
}
