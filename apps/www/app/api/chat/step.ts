import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import { getSourceReferencesFromMessages } from "@repo/ai/lib/source";
import { createPrompt } from "@repo/ai/prompt/utils";
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
          system: [
            system,
            createPrompt({
              taskContext: `
                # Continuation Source Policy

                Continue from the evidence already gathered in earlier steps.
                Preserve every source constraint from the user request and the specialist evidence.
              `,
              outputFormatting: `
                # User-Facing Citation Format

                Cite sources inline in the exact sentence they support.
                Use [text](url) links with concise, human-readable text.
                Use only links already present in specialist evidence, current page context, or verified Nakafa content.
                Do not add product homepages, documentation links, or source links from memory.
                When specialist evidence contains markdown links, preserve those links in the final answer for every claim that uses that evidence.
                If the answer has sections or bullets built from source-backed research, each source-backed section or bullet must keep at least one supporting link.
                When evidence contains an inline citation field, integrate that link into the supported sentence or omit it when the link would not help the user.
                Never show numeric citation markers such as [1] or [4, 21, 23] to users.
                Convert any research citation indexes into markdown links using the cited source URLs.
                Never append a final source, reference, citation, or bibliography section in any language.
                Do not collect links at the end of the answer.
              `,
            }),
          ].join("\n\n"),
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
