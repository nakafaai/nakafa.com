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
          messages,
          system: [
            system,
            createPrompt({
              taskContext: `
                # Continuation Source Policy

                Continue from the evidence already gathered in earlier steps.
                Preserve every source constraint from the user request and the specialist evidence.
              `,
              toolUsageGuidelines: `
                # Continuation Tool Guidance

                Continue with the model's tool choice, using gathered evidence as the decision source.

                Call math before the final answer when:
                - Nakafa selected educational math content.
                - The final answer will include calculations, formulas, numeric answers, answer keys, or correctness claims.

                The math task must verify the exact example, exercise, answer key, and numeric claims that will appear in the final answer.

                Do not call math after Nakafa when:
                - The content is a non-math lesson, Quran, article, or definition without calculation.
                - The source summary contains no mathematical verification target.

                After math returns, do not switch to different mathematical content unless you call math again for that replacement content.
              `,
              outputFormatting: `
                # User-Facing Citation Format

                Cite external research sources inline in the exact sentence they support.
                Use [text](url) links with concise, human-readable text.
                Use only links already present in external research evidence or current page context.
                Do not add product homepages, documentation links, or source links from memory.
                When research evidence contains markdown links, preserve those links in the final answer for every claim that uses that evidence.
                If the answer has sections or bullets built from source-backed research, each source-backed section or bullet must keep at least one supporting link.
                Do not add Nakafa source labels, Nakafa domain links, or citation-style links for Nakafa-owned content.
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
        return { ...nakafaStep, messages };
      }

      if (getSourceReferencesFromMessages(messages).length > 0) {
        return { ...researchStep, messages };
      }

      return { ...groundingStep, messages };
    })
);
