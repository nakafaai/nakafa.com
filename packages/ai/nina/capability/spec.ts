import { Schema } from "effect";

export const LEARNING_CAPABILITY_NAME_VALUES = [
  "nakafa",
  "deepResearch",
  "math",
] as const;

/** Schema-owned names for Nina's internal education capabilities. */
export const LearningCapabilityNameSchema = Schema.Literal(
  ...LEARNING_CAPABILITY_NAME_VALUES
);

export type LearningCapabilityName = Schema.Schema.Type<
  typeof LearningCapabilityNameSchema
>;

export const NAKAFA_CAPABILITY = "nakafa" satisfies LearningCapabilityName;
export const RESEARCH_CAPABILITY =
  "deepResearch" satisfies LearningCapabilityName;
export const MATH_CAPABILITY = "math" satisfies LearningCapabilityName;

export const EVIDENCE_STATUS_VALUES = [
  "available",
  "limited",
  "failed",
  "denied",
] as const;

/** Bounded status values that describe whether evidence may constrain Nina. */
export const EvidenceStatusSchema = Schema.Literal(...EVIDENCE_STATUS_VALUES);

/**
 * Schema-owned evidence envelope returned by a LearningCapability.
 *
 * The summary is the compact model-visible evidence. References and
 * limitations stay bounded so future traces can persist summaries without
 * storing raw specialist transcripts.
 */
export class EvidenceEnvelope extends Schema.Class<EvidenceEnvelope>(
  "EvidenceEnvelope"
)({
  capability: LearningCapabilityNameSchema,
  limitations: Schema.optional(
    Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable)
  ),
  refs: Schema.optional(Schema.Array(Schema.String).pipe(Schema.mutable)),
  status: EvidenceStatusSchema,
  summary: Schema.String,
}) {}

/**
 * Minimal LearningCapability result shape that can be rendered to a model and
 * summarized in operational traces.
 */
export class LearningCapabilityResult extends Schema.Class<LearningCapabilityResult>(
  "LearningCapabilityResult"
)({
  evidence: EvidenceEnvelope,
  text: Schema.String,
}) {}

/**
 * Bounded operational trace for one LearningCapability execution.
 *
 * This intentionally stores evidence summaries and references, not raw chat
 * transcripts or full model/tool payloads.
 */
export class CapabilityTrace extends Schema.Class<CapabilityTrace>(
  "CapabilityTrace"
)({
  capability: LearningCapabilityNameSchema,
  durationMs: Schema.Number,
  endedAt: Schema.Number,
  evidence: EvidenceEnvelope,
  responseMessageIdentifier: Schema.String,
  startedAt: Schema.Number,
  toolCallId: Schema.optional(Schema.String),
}) {}

/** Expected LearningCapability failure surfaced through the Effect channel. */
export class LearningCapabilityError extends Schema.TaggedError<LearningCapabilityError>()(
  "LearningCapabilityError",
  {
    capability: LearningCapabilityNameSchema,
    message: Schema.String,
  }
) {}
