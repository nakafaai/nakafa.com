import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { getSourceReferencesFromMessages } from "@repo/ai/lib/source";
import type { ModelMessage } from "ai";
import { Effect } from "effect";

const firstStepNumber = 0;
const nakafaStep = {
  activeTools: [TOOL_NAMES.nakafa],
  toolChoice: { toolName: TOOL_NAMES.nakafa, type: "tool" as const },
};
const researchStep = {
  activeTools: [TOOL_NAMES.deepResearch],
  toolChoice: { toolName: TOOL_NAMES.deepResearch, type: "tool" as const },
};

/**
 * Chooses an AI SDK `prepareStep` override only when Nakafa has a known
 * deterministic route.
 *
 * Page fetches must read Nakafa content first. Explicit external URLs must go
 * through research. Everything else stays automatic so simple turns can answer
 * directly.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 */
export const prepareChatStep = Effect.fn("chat.prepareChatStep")(
  ({
    messages,
    needsPageFetch,
    stepNumber,
  }: {
    messages: ModelMessage[];
    needsPageFetch: boolean;
    stepNumber: number;
  }) =>
    Effect.sync(() => {
      if (stepNumber !== firstStepNumber) {
        return;
      }

      if (needsPageFetch) {
        return nakafaStep;
      }

      if (getSourceReferencesFromMessages(messages).length > 0) {
        return researchStep;
      }

      return;
    })
);
