import {
  type LearningCapabilityName,
  NAKAFA_CAPABILITY,
  RESEARCH_CAPABILITY,
} from "@repo/backend/confect/nina/capability/spec";
import {
  getNakafaReferencesFromMessages,
  getSourceReferencesFromMessages,
} from "@repo/backend/confect/nina/research/source";
import type { ModelMessage, Tool, ToolLoopAgentSettings } from "ai";
import { Array as Arr, Effect } from "effect";

const firstStepNumber = 0;

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
 * research for the outside link. It starts only with a capability the turn
 * offers (`capabilities`): the SDK lists no other tool in the step, so a call
 * forced to it could never be made. It changes nothing else. The instructions
 * and the tool list stay the same in every step of a turn, so each later step
 * reads the prompt prefix the first one cached. The current page arrives in the
 * prompt context, so no step forces a page read.
 */
export function prepareNinaStep(
  { messages, stepNumber }: NinaPrepareStepInput,
  capabilities: readonly LearningCapabilityName[]
): NinaPreparedStep {
  if (stepNumber !== firstStepNumber) {
    return { messages };
  }
  const capability = firstCapability(messages, capabilities);
  if (!capability) {
    return { messages };
  }

  return { messages, toolChoice: { toolName: capability, type: "tool" } };
}

/**
 * Nina's AI SDK step callback as the SDK calls it, when the step's own timer
 * has just started. It marks the start of the step through `begin`, so a
 * capability that the step runs counts its time from there, and then prepares
 * the step for the capabilities the turn offers.
 */
export const startNinaStep = Effect.fn("nina.step.start")(function* (
  begin: Effect.Effect<void>,
  capabilities: readonly LearningCapabilityName[],
  input: NinaPrepareStepInput
) {
  yield* begin;
  return prepareNinaStep(input, capabilities);
});

/**
 * The capability a prompt's links start with, if it holds a link that an
 * offered capability reads.
 */
function firstCapability(
  messages: ModelMessage[],
  capabilities: readonly LearningCapabilityName[]
) {
  if (
    Arr.contains(capabilities, RESEARCH_CAPABILITY) &&
    getSourceReferencesFromMessages(messages).length > 0
  ) {
    return RESEARCH_CAPABILITY;
  }
  if (
    Arr.contains(capabilities, NAKAFA_CAPABILITY) &&
    getNakafaReferencesFromMessages(messages).length > 0
  ) {
    return NAKAFA_CAPABILITY;
  }
}
