import {
  EVIDENCE_STATUS_VALUES,
  LEARNING_CAPABILITY_NAME_VALUES,
} from "@repo/ai/nina/capability/spec";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const CAPABILITY_TRACE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const CAPABILITY_TRACE_BATCH_SIZE = 100;

const capabilityNameValidator = literals(...LEARNING_CAPABILITY_NAME_VALUES);
const evidenceStatusValidator = literals(...EVIDENCE_STATUS_VALUES);

/** Convex-owned validator for a bounded LearningCapability evidence summary. */
export const evidenceEnvelopeValidator = v.object({
  capability: capabilityNameValidator,
  limitations: v.optional(v.array(v.string())),
  refs: v.optional(v.array(v.string())),
  status: evidenceStatusValidator,
  summary: v.string(),
});

/** App-provided CapabilityTrace payload before Convex attaches ownership data. */
export const capabilityTraceInputValidator = v.object({
  capability: capabilityNameValidator,
  durationMs: v.number(),
  endedAt: v.number(),
  evidence: evidenceEnvelopeValidator,
  responseMessageIdentifier: v.string(),
  startedAt: v.number(),
  toolCallId: v.optional(v.string()),
});

/** Persisted operational trace row for one LearningCapability execution. */
export const capabilityTraceValidator = v.object({
  ...capabilityTraceInputValidator.fields,
  chatId: v.id("chats"),
  expiresAt: v.number(),
  status: evidenceStatusValidator,
  userId: v.id("users"),
});

/** Persisted trace document shape returned by bounded owner-scoped reads. */
export const capabilityTraceRecordValidator = v.object({
  ...capabilityTraceValidator.fields,
  _creationTime: v.number(),
  _id: v.id("ninaCapabilityTraces"),
});

/** Arguments for owner-scoped support reads of recent capability traces. */
export const listCapabilityTracesArgs = {
  chatId: v.id("chats"),
  limit: v.optional(v.number()),
  responseMessageIdentifier: v.optional(v.string()),
};

export const listCapabilityTracesArgsValidator = v.object(
  listCapabilityTracesArgs
);

/** Arguments for bounded operational retention cleanup. */
export const deleteExpiredCapabilityTracesArgs = {
  now: v.number(),
};

export const deleteExpiredCapabilityTracesArgsValidator = v.object(
  deleteExpiredCapabilityTracesArgs
);

/** Result returned by one bounded trace retention cleanup page. */
export const deleteExpiredCapabilityTracesResultValidator = v.object({
  deleted: v.number(),
  hasMore: v.boolean(),
});

export type CapabilityTraceInput = Infer<typeof capabilityTraceInputValidator>;
export type ListCapabilityTracesArgs = Infer<
  typeof listCapabilityTracesArgsValidator
>;
export type DeleteExpiredCapabilityTracesArgs = Infer<
  typeof deleteExpiredCapabilityTracesArgsValidator
>;
