import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import type {
  NakafaAgentSearchInput,
  NakafaAgentSearchResult,
} from "@repo/contents/agent/schema/search";
import { NAKAFA_AGENT_MAX_QUERIES } from "@repo/contents/agent/search";
import type { ModelMessage } from "ai";
import { Array as Arr, Predicate } from "effect";

/**
 * Detects search results that need a full content read before Nina answers.
 */
function shouldReadAfterSearch(
  input: NakafaAgentSearchInput,
  result: NakafaAgentSearchResult | null
) {
  if (result === null) {
    return false;
  }

  if (input.section === "quran") {
    return false;
  }

  return Arr.some(
    result.items,
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
 * Builds the steps that read the links to Nakafa's own site that the learner
 * sent, so the evidence comes from the pages the learner sent and not from a
 * search for their topic. A step forces the read tool and lists the addresses
 * no earlier step has asked for, so the model cannot move on, or answer, before
 * it has asked for every one.
 */
export function prepareAddressStep<const ToolName extends string>(
  addresses: readonly string[],
  messages: ModelMessage[],
  steps: readonly {
    readonly toolCalls: readonly {
      readonly input: unknown;
      readonly toolName: ToolName;
    }[];
  }[]
) {
  const unread = Arr.filter(
    addresses,
    (address) =>
      !Arr.some(steps, (step) =>
        Arr.some(
          step.toolCalls,
          (toolCall) =>
            toolCall.toolName === "read" &&
            Predicate.hasProperty(toolCall.input, "content_ref") &&
            toolCall.input.content_ref === address
        )
      )
  );

  if (unread.length === 0) {
    return;
  }

  const message = {
    role: "user",
    content: createPrompt({
      taskContext: `
        # Required Next Step

        Call the read tool now, once for each Nakafa address below, all in this step, with that address as content_ref.
      `,
      toolUsageGuidelines: `
        # Tool Constraints

        - Read every address before any search.
        - Do not change an address.
      `,
      detailedTaskInstructions: `
        # Nakafa Addresses To Read

        ${Arr.join(
          Arr.map(unread, (address) => `- ${address}`),
          "\n"
        )}
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

        Call the read tool now with the single most relevant content_id. When the
        search result names a section to read for it, pass that section too.
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
  const hasTaxonomyToolCall = Arr.some(steps, (step) =>
    Arr.some(step.toolCalls, (toolCall) => toolCall.toolName === "taxonomy")
  );

  if (!hasTaxonomyToolCall) {
    return;
  }

  const hasOtherToolCall = Arr.some(steps, (step) =>
    Arr.some(step.toolCalls, (toolCall) => toolCall.toolName !== "taxonomy")
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
function shouldAnswerFromNakafaEvidence<const ToolName extends string>(
  steps: readonly {
    readonly toolCalls: readonly { readonly toolName: ToolName }[];
  }[]
) {
  const searchCalls = Arr.flatMap(steps, (step) =>
    Arr.filter(step.toolCalls, (toolCall) => toolCall.toolName === "search")
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
