import { createPrompt } from "@repo/ai/prompt/utils";
import { NAKAFA_AGENT_MAX_QUERIES } from "@repo/contents/_lib/agent/constants";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/_lib/agent/schema/search";
import type { ModelMessage } from "ai";

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

  if (input.section === "quran") {
    return false;
  }

  return result.items.some(
    (item) => item.section === "articles" || item.section === "material"
  );
}

/**
 * Classifies the forced follow-up work needed after one Nakafa search result.
 */
export function readSearchFollowup(
  input: NakafaAgentSearchInput,
  result: NakafaAgentSearchResult | null
) {
  return {
    shouldReadContent: shouldReadAfterSearch(input, result),
  };
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
    content: createPrompt({
      taskContext: `
        # Required Next Step

        Call the read tool now with the single most relevant content_id.
      `,
      toolUsageGuidelines: `
        # Tool Constraints

        - Use the Nakafa search results already in this conversation.
        - Use that full content before answering.
        - Do not call search again before reading.
      `,
    }),
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
  steps: readonly {
    readonly toolCalls: readonly { readonly toolName: ToolName }[];
  }[]
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
    content: createPrompt({
      taskContext: `
        # Required Final Step

        Use the Nakafa taxonomy result already in this conversation.
      `,
      toolUsageGuidelines: `
        # Tool Constraints

        - Do not call another Nakafa tool.
        - Answer only with supported taxonomy data.
      `,
      detailedTaskInstructions: `
        # Supported Taxonomy Data

        - sections.
        - filters.
        - categories.
        - materials.
        - grades.
        - tools.
        - paths.
      `,
    }),
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
  steps: readonly {
    readonly toolCalls: readonly { readonly toolName: ToolName }[];
  }[]
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
>(
  messages: ModelMessage[],
  steps: readonly {
    readonly toolCalls: readonly { readonly toolName: ToolName }[];
  }[]
) {
  if (!shouldAnswerFromNakafaEvidence(steps)) {
    return;
  }

  const message = {
    role: "user",
    content: createPrompt({
      taskContext: `
        # Required Final Step

        Use the Nakafa tool results already in this conversation.
      `,
      toolUsageGuidelines: `
        # Tool Constraints

        - Do not call another Nakafa tool.
      `,
      detailedTaskInstructions: `
        # Answer Contract

        - Write the final source-backed answer now.
        - If a requested item is still missing, say that Nakafa did not return enough data for that item.
      `,
    }),
  } satisfies ModelMessage;

  return {
    messages: [...messages, message],
    toolChoice: "none" as const,
  };
}
