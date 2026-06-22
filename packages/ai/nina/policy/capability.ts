import {
  EvidenceEnvelope,
  type LearningCapabilityName,
  LearningCapabilityResult,
  MATH_CAPABILITY,
  NAKAFA_CAPABILITY,
  RESEARCH_CAPABILITY,
} from "@repo/ai/nina/capability/spec";
import type { AgentContext } from "@repo/ai/types/agents";
import { Schema } from "effect";

/** Schema-owned permission result for a Nina capability in one turn. */
export const NinaCapabilityDecisionSchema = Schema.Struct({
  reason: Schema.optional(Schema.String),
  state: Schema.Literal("allowed", "denied", "needs-confirmation"),
}).pipe(Schema.mutable);

export type NinaCapabilityDecision = Schema.Schema.Type<
  typeof NinaCapabilityDecisionSchema
>;

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

  return { state: "allowed" };
}

/** Builds model-facing evidence for a capability denied by turn policy. */
export function deniedCapabilityResult({
  capability,
  decision,
}: {
  readonly capability: LearningCapabilityName;
  readonly decision: NinaCapabilityDecision;
}) {
  const text = [
    "# Capability Policy",
    "",
    `- Capability: ${capability}`,
    "- Status: denied",
    `- Reason: ${decision.reason ?? "Not allowed for this Nina context."}`,
    "",
    "# Final Answer Constraint",
    "",
    "Use only evidence already available in the conversation.",
    "Do not invent unavailable Nakafa, research, or math evidence.",
  ].join("\n");

  return LearningCapabilityResult.make({
    evidence: EvidenceEnvelope.make({
      capability,
      limitations: [decision.reason ?? "Not allowed for this Nina context."],
      status: "denied",
      summary: text,
    }),
    text,
  });
}
