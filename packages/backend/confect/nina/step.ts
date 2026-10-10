import {
  type LearningCapabilityName,
  RESEARCH_CAPABILITY,
} from "@repo/backend/confect/nina/capability/spec";
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
 * Nina's AI SDK step callback: a first step whose prompt names sources starts
 * with research. It changes nothing else. The instructions and the tool list
 * stay the same in every step of a turn, so each later step reads the prompt
 * prefix the first one cached. The current page arrives in the prompt
 * context, so no step forces a page read.
 */
export function prepareNinaStep({
  messages,
  stepNumber,
}: NinaPrepareStepInput): NinaPreparedStep {
  if (
    stepNumber === firstStepNumber &&
    getSourceReferencesFromMessages(messages).length > 0
  ) {
    return {
      messages,
      toolChoice: { toolName: RESEARCH_CAPABILITY, type: "tool" },
    };
  }

  return { messages };
}
