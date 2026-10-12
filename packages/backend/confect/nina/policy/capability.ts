import type { CapabilityOutput } from "@repo/backend/confect/nina/capability/progress";
import {
  type LearningCapabilityName,
  MATH_CAPABILITY,
  MEMORY_CAPABILITY,
  NAKAFA_CAPABILITY,
  RESEARCH_CAPABILITY,
} from "@repo/backend/confect/nina/capability/spec";
import type { AgentContext } from "@repo/backend/confect/nina/contract/agent";
import { Array as Arr, Schema } from "effect";

/** Schema-owned permission result for a Nina capability in one turn. */
const NinaCapabilityDecisionSchema = Schema.Union([
  Schema.Struct({ state: Schema.Literal("allowed") }),
  Schema.Struct({ state: Schema.Literal("denied"), reason: Schema.String }),
]);
type NinaCapabilityDecision = typeof NinaCapabilityDecisionSchema.Type;

/**
 * Why the memory capability is denied while the learner has paused memory. The
 * policy decides it for a turn from its context, and the capability decides it
 * again for a call, because the learner may pause while the turn runs.
 */
export const MEMORY_PAUSED = {
  state: "denied",
  reason:
    "The learner paused memory, so what they told Nina before is not available. Tell the learner you cannot look it up while memory is paused.",
} satisfies NinaCapabilityDecision;

/** Resolves whether one Nina capability may run under the immutable context pack. */
export function decideNinaCapability({
  capability,
  context,
}: {
  readonly capability: LearningCapabilityName;
  readonly context: AgentContext;
}): NinaCapabilityDecision {
  const tools = context.nina?.tools;
  if (!tools) {
    return {
      state: "denied",
      reason: "Nina context is unavailable for this turn.",
    };
  }
  if (capability === NAKAFA_CAPABILITY && !tools.allowNakafa) {
    return {
      state: "denied",
      reason: "Nakafa evidence is not allowed for this context.",
    };
  }
  if (capability === RESEARCH_CAPABILITY && !tools.allowDeepResearch) {
    return {
      state: "denied",
      reason: "External research is not allowed for this context.",
    };
  }
  if (capability === MATH_CAPABILITY && !tools.allowMath) {
    return {
      state: "denied",
      reason: "Math verification is not allowed for this context.",
    };
  }
  if (capability === MEMORY_CAPABILITY && context.memory !== true) {
    return MEMORY_PAUSED;
  }
  return { state: "allowed" };
}
/** Builds model-facing evidence for a capability denied by turn policy. */
export function deniedCapabilityResult({
  capability,
  decision,
}: {
  readonly capability: LearningCapabilityName;
  readonly decision: Extract<NinaCapabilityDecision, { state: "denied" }>;
}) {
  const text = Arr.join(
    [
      "# Capability Policy",
      "",
      `- Capability: ${capability}`,
      "- Status: denied",
      `- Reason: ${decision.reason}`,
      "",
      "# Final Answer Constraint",
      "",
      "Use only evidence already available in the conversation.",
      "Do not invent what this capability would have returned.",
    ],
    "\n"
  );
  return { outcome: "denied", text } satisfies Pick<
    CapabilityOutput,
    "text" | "outcome"
  >;
}
