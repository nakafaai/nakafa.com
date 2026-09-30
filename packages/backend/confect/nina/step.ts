import {
  type LearningCapabilityName,
  RESEARCH_CAPABILITY,
} from "@repo/backend/confect/nina/capability/spec";
import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import { getSourceReferencesFromMessages } from "@repo/backend/confect/nina/research/source";
import type { Tool, ToolLoopAgentSettings } from "ai";

const firstStepNumber = 0;

export type NinaToolSet = Record<LearningCapabilityName, Tool>;

/** AI SDK-derived callback type for Nina's per-step tool policy. */
export type NinaPrepareStep = NonNullable<
  ToolLoopAgentSettings<never, NinaToolSet>["prepareStep"]
>;

type NinaPrepareStepInput = Parameters<NinaPrepareStep>[0];
type NinaPreparedStep = Awaited<ReturnType<NinaPrepareStep>>;

/**
 * Creates Nina's AI SDK step callback.
 *
 * The returned function uses the SDK-owned `prepareStep` contract and only
 * decides first-step evidence routing plus continuation source policy; it does
 * not own ToolLoopAgent wiring or duplicate the SDK callback input shape. The
 * current page arrives in the prompt context, so no step forces a page read.
 */
export function createNinaPrepareStep({
  instructions,
}: {
  readonly instructions: string;
}): (input: NinaPrepareStepInput) => NinaPreparedStep {
  return ({ messages, stepNumber }) => {
    if (stepNumber !== firstStepNumber) {
      return {
        instructions: [
          instructions,
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

              The math input must verify the exact example, exercise, answer key, and numeric claims that will appear in the final answer.

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
        messages,
      };
    }

    if (getSourceReferencesFromMessages(messages).length > 0) {
      return {
        activeTools: [RESEARCH_CAPABILITY],
        messages,
        toolChoice: { toolName: RESEARCH_CAPABILITY, type: "tool" },
      };
    }

    return { messages };
  };
}
