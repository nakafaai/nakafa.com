import { getSourceReferencesFromMessages } from "@repo/ai/lib/source";
import {
  type LearningCapabilityName,
  NAKAFA_CAPABILITY,
  RESEARCH_CAPABILITY,
} from "@repo/ai/nina/capability/spec";
import { createPrompt } from "@repo/ai/prompt/utils";
import type { Tool, ToolLoopAgentSettings, ToolSet } from "ai";

const firstStepNumber = 0;

type RequiredStepToolName =
  | typeof NAKAFA_CAPABILITY
  | typeof RESEARCH_CAPABILITY;

export type NinaToolSet = ToolSet & Record<RequiredStepToolName, Tool>;

/** AI SDK-derived callback type for Nina's per-step tool policy. */
export type NinaPrepareStep = NonNullable<
  ToolLoopAgentSettings<never, NinaToolSet>["prepareStep"]
>;

/**
 * Creates Nina's AI SDK step callback from verified page-fetch state.
 *
 * The returned function uses the SDK-owned `prepareStep` contract and only
 * decides first-step evidence routing plus continuation source policy; it does
 * not own ToolLoopAgent wiring or duplicate the SDK callback input shape.
 */
export function createNinaPrepareStep({
  needsPageFetch,
  instructions,
}: {
  readonly instructions: string;
  readonly needsPageFetch: boolean;
}): NinaPrepareStep {
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

    if (needsPageFetch) {
      return readToolStep({
        messages,
        toolName: NAKAFA_CAPABILITY,
      });
    }

    if (getSourceReferencesFromMessages(messages).length > 0) {
      return readToolStep({
        messages,
        toolName: RESEARCH_CAPABILITY,
      });
    }

    return { messages };
  };
}

/** Builds the SDK-owned first-step shape for one required Nina evidence tool. */
function readToolStep({
  messages,
  toolName,
}: {
  readonly messages: Parameters<NinaPrepareStep>[0]["messages"];
  readonly toolName: Extract<LearningCapabilityName, RequiredStepToolName>;
}): ReturnType<NinaPrepareStep> {
  return {
    activeTools: [toolName],
    messages,
    toolChoice: { toolName, type: "tool" },
  };
}
