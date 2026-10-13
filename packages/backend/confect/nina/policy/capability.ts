import type { CapabilityOutput } from "@repo/backend/confect/nina/capability/progress";
import type { AgentContext } from "@repo/backend/confect/nina/contract/agent";
import { Array as Arr, Record as Rec, Schema } from "effect";

/** Schema-owned permission result for a Nina capability in one turn. */
const CapabilityDecisionSchema = Schema.Union([
  Schema.Struct({ state: Schema.Literal("allowed") }),
  Schema.Struct({ state: Schema.Literal("denied"), reason: Schema.String }),
]);
export type CapabilityDecision = typeof CapabilityDecisionSchema.Type;

/** The decision of a capability that the turn's context offers. */
export const ALLOWED = { state: "allowed" } satisfies CapabilityDecision;

/** The decision of a capability that the turn's context does not offer, with the reason Nina reads. */
export function denied(reason: string) {
  return { state: "denied", reason } satisfies CapabilityDecision;
}

/**
 * What a capability decides on: whether the learner's memory is on, and Nina's
 * context pack with the tool permissions of the turn. A turn that has no pack
 * offers no capability, so a capability never sees the absence of one.
 */
export type OfferContext = Pick<AgentContext, "memory"> & {
  [Key in "nina"]-?: NonNullable<AgentContext[Key]>;
};

/** The part of a capability that the policy reads. */
interface Offering {
  readonly offered: (context: OfferContext) => CapabilityDecision;
}

/**
 * Raised by a capability's run when its conditions changed after the policy
 * allowed the call, for example a learner who paused memory while the turn ran.
 * The shared runner answers it like a refusal by the policy.
 */
export class CapabilityDenied extends Schema.TaggedError<CapabilityDenied>()(
  "CapabilityDenied",
  { reason: Schema.String }
) {}

/**
 * Resolves whether one capability may run under the turn's context. It fails
 * closed: a turn without Nina's context pack allows nothing, and a capability
 * is allowed only by its own `offered`, which every definition must give.
 */
export function decideCapability(
  capability: Offering,
  { memory, nina }: Pick<AgentContext, "memory" | "nina">
) {
  if (!nina) {
    return denied("Nina context is unavailable for this turn.");
  }
  return capability.offered({ memory, nina });
}

/**
 * Lists the capabilities of a registry that the context offers, in the order of
 * the registry. The prompt, the tools Nina is offered, and the policy of each
 * call all follow it.
 */
export function offeredCapabilities<Name extends string>(
  registry: Rec.ReadonlyRecord<Name, Offering>,
  context: Pick<AgentContext, "memory" | "nina">
) {
  return Arr.filter(
    Rec.keys(registry),
    (name) => decideCapability(registry[name], context).state === "allowed"
  );
}

/** Builds model-facing evidence for a capability denied by turn policy. */
export function deniedCapabilityResult({
  capability,
  reason,
}: {
  readonly capability: string;
  readonly reason: string;
}) {
  const text = Arr.join(
    [
      "# Capability Policy",
      "",
      `- Capability: ${capability}`,
      "- Status: denied",
      `- Reason: ${reason}`,
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
