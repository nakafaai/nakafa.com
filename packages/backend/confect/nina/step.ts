import type { LearningCapabilityName } from "@repo/backend/confect/nina/capability/spec";
import {
  getNakafaReferencesFromMessages,
  getSourceReferencesFromMessages,
} from "@repo/backend/confect/nina/research/source";
import type { ModelMessage, Tool, ToolLoopAgentSettings } from "ai";
import { Effect } from "effect";

const firstStepNumber = 0;

/** The capability that reads the links to Nakafa's own site. */
const NAKAFA_CAPABILITY = "nakafa" satisfies LearningCapabilityName;

/** The capability that reads the links to outside sites. */
const RESEARCH_CAPABILITY = "deepResearch" satisfies LearningCapabilityName;

export type NinaToolSet = Record<LearningCapabilityName, Tool>;

/** AI SDK-derived callback type for Nina's per-step tool policy. */
export type NinaPrepareStep = NonNullable<
  ToolLoopAgentSettings<never, NinaToolSet>["prepareStep"]
>;

type NinaPrepareStepInput = Parameters<NinaPrepareStep>[0];
type NinaPreparedStep = Awaited<ReturnType<NinaPrepareStep>>;

/**
 * Nina's AI SDK step callback: a first step whose prompt names a source starts
 * with the capability that reads it. A link to an outside site starts with
 * research, which reads it from the web. A link to Nakafa's own site starts with
 * Nakafa, which reads its signed content. A prompt with both starts with
 * research for the outside link. It changes nothing else. The instructions and
 * the tool list stay the same in every step of a turn, so each later step reads
 * the prompt prefix the first one cached. The current page arrives in the
 * prompt context, so no step forces a page read.
 */
export function prepareNinaStep({
  messages,
  stepNumber,
}: NinaPrepareStepInput): NinaPreparedStep {
  if (stepNumber !== firstStepNumber) {
    return { messages };
  }
  const capability = firstCapability(messages);
  if (!capability) {
    return { messages };
  }

  return { messages, toolChoice: { toolName: capability, type: "tool" } };
}

/**
 * Nina's AI SDK step callback as the SDK calls it, when the step's own timer
 * has just started. It marks the start of the step through `begin`, so a
 * capability that the step runs counts its time from there, and then prepares
 * the step.
 */
export const startNinaStep = Effect.fn("nina.step.start")(function* (
  begin: Effect.Effect<void>,
  input: NinaPrepareStepInput
) {
  yield* begin;
  return prepareNinaStep(input);
});

/** The capability a prompt's links start with, if it holds any link. */
function firstCapability(messages: ModelMessage[]) {
  if (getSourceReferencesFromMessages(messages).length > 0) {
    return RESEARCH_CAPABILITY;
  }
  if (getNakafaReferencesFromMessages(messages).length > 0) {
    return NAKAFA_CAPABILITY;
  }
}
