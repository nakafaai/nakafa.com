import { TOOL_NAMES } from "@repo/ai/agents/orchestrator/names";
import type { ToolName } from "@repo/ai/schema/tools";
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
  readonly capability: ToolName;
  readonly context: AgentContext;
}): NinaCapabilityDecision {
  const tools = context.nina?.tools;

  if (!tools) {
    return {
      state: "denied",
      reason: "Nina context is unavailable for this turn.",
    };
  }

  if (capability === TOOL_NAMES.nakafa && !tools.allowNakafa) {
    return {
      state: "denied",
      reason: "Nakafa evidence is not allowed for this context.",
    };
  }

  if (capability === TOOL_NAMES.deepResearch && !tools.allowDeepResearch) {
    return {
      state: "denied",
      reason: "External research is not allowed for this context.",
    };
  }

  if (capability === TOOL_NAMES.math && !tools.allowMath) {
    return {
      state: "denied",
      reason: "Math verification is not allowed for this context.",
    };
  }

  return { state: "allowed" };
}

/** Builds model-facing evidence for a capability denied by turn policy. */
export function formatDeniedCapability({
  capability,
  decision,
}: {
  readonly capability: ToolName;
  readonly decision: NinaCapabilityDecision;
}) {
  return [
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
}
