import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  EVIDENCE_STATUS_VALUES,
  LEARNING_CAPABILITY_NAME_VALUES,
} from "@repo/backend/confect/nina/capability/spec";
import { Schema } from "effect";
export const CAPABILITY_TRACE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const CAPABILITY_TRACE_BATCH_SIZE = 100;
const capabilityNameValidator = Schema.Literals([
  ...LEARNING_CAPABILITY_NAME_VALUES,
]);
const evidenceStatusValidator = Schema.Literals([...EVIDENCE_STATUS_VALUES]);

/** Convex-owned validator for a bounded LearningCapability evidence summary. */
export const evidenceEnvelopeValidator = Schema.Struct({
  capability: capabilityNameValidator,
  limitations: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  refs: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  status: evidenceStatusValidator,
  summary: Schema.String,
});

/** App-provided CapabilityTrace payload before Convex attaches ownership data. */
export const capabilityTraceInputValidator = Schema.Struct({
  capability: capabilityNameValidator,
  durationMs: Schema.Finite,
  endedAt: Schema.Finite,
  evidence: evidenceEnvelopeValidator,
  responseMessageIdentifier: Schema.String,
  startedAt: Schema.Finite,
  toolCallId: Schema.optionalKey(Schema.String),
});

/** Persisted operational trace row for one LearningCapability execution. */
export const capabilityTraceValidator = Schema.Struct({
  ...capabilityTraceInputValidator.fields,
  chatId: IdSchema("chats"),
  expiresAt: Schema.Finite,
  status: evidenceStatusValidator,
  userId: IdSchema("users"),
});

/** Persisted trace document shape returned by bounded owner-scoped reads. */

/** Arguments for owner-scoped support reads of recent capability traces. */
export const listCapabilityTracesArgs = {
  chatId: IdSchema("chats"),
  limit: Schema.optionalKey(Schema.Finite),
  responseMessageIdentifier: Schema.optionalKey(Schema.String),
};
export const listCapabilityTracesArgsValidator = Schema.Struct(
  listCapabilityTracesArgs
);

/** Arguments for bounded operational retention cleanup. */
export const deleteExpiredCapabilityTracesArgs = {
  now: Schema.Finite,
};
export const deleteExpiredCapabilityTracesArgsValidator = Schema.Struct(
  deleteExpiredCapabilityTracesArgs
);

/** Result returned by one bounded trace retention cleanup page. */
export const deleteExpiredCapabilityTracesResultValidator = Schema.Struct({
  deleted: Schema.Finite,
  hasMore: Schema.Boolean,
});
export type CapabilityTraceInput = Schema.Schema.Type<
  typeof capabilityTraceInputValidator
>;
export type ListCapabilityTracesArgs = Schema.Schema.Type<
  typeof listCapabilityTracesArgsValidator
>;
export type DeleteExpiredCapabilityTracesArgs = Schema.Schema.Type<
  typeof deleteExpiredCapabilityTracesArgsValidator
>;
