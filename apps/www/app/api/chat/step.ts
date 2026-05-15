import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { finalAnswerSourcePolicy } from "@repo/ai/agents/orchestrator/prompt";
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
const groundingStep = {
  toolChoice: "required" as const,
};

/**
 * Chooses the first-step AI SDK tool policy for grounded chat answers.
 *
 * Page fetches must read Nakafa content first. Explicit external URLs must go
 * through research. Other first-turn requests must choose one evidence tool so
 * factual educational answers cannot bypass grounding.
 *
 * @see https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
 * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
 */
export const prepareChatStep = Effect.fn("chat.prepareChatStep")(
  ({
    messages,
    needsPageFetch,
    system,
    stepNumber,
  }: {
    messages: ModelMessage[];
    needsPageFetch: boolean;
    system: string;
    stepNumber: number;
  }) =>
    Effect.sync(() => {
      if (stepNumber !== firstStepNumber) {
        return {
          system: [system, finalAnswerSourcePolicy].join("\n\n"),
        };
      }

      if (needsPageFetch) {
        return nakafaStep;
      }

      if (getSourceReferencesFromMessages(messages).length > 0) {
        return researchStep;
      }

      return groundingStep;
    })
);
