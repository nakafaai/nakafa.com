import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { makeLiveAudioJournal } from "@repo/backend/convex/contentRelease/cutover/audioComponent";
import {
  type AudioWorkflowAudit,
  AudioWorkflowJournal,
  auditAudioWorkflowJournal,
  cleanupAudioWorkflowJournal,
  validateAudioWorkflowAudit,
} from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import { audioWorkflowAuditValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const checkpointValidator = v.object({
  audit: v.optional(audioWorkflowAuditValidator),
  auditedAt: v.optional(v.number()),
  cleanedAt: v.optional(v.number()),
});
const cleanupResultValidator = v.object({
  cleaned: v.number(),
  complete: v.boolean(),
  remainingSteps: v.number(),
  remainingWorkflows: v.number(),
});
const auditResultValidator = v.object({
  complete: v.literal(true),
  failed: v.number(),
  steps: v.number(),
  succeeded: v.number(),
  total: v.number(),
  workflows: v.array(
    v.object({
      id: v.string(),
      result: v.union(v.literal("failed"), v.literal("success")),
      steps: v.number(),
    })
  ),
});

/** Authenticates the exact terminal audio journal before cleanup begins. */
export const audit = internalAction({
  args: {},
  returns: auditResultValidator,
  handler: (ctx) =>
    runConvexActionProgram(
      auditAudioWorkflowJournal().pipe(
        Effect.provideService(AudioWorkflowJournal, makeLiveAudioJournal(ctx))
      )
    ),
});

/** Deletes one bounded batch from the frozen terminal audio journal. */
export const cleanup = internalAction({
  args: {},
  returns: cleanupResultValidator,
  handler: (ctx) =>
    runConvexActionProgram(
      cleanupAudioWorkflowJournal().pipe(
        Effect.provideService(AudioWorkflowJournal, makeLiveAudioJournal(ctx))
      )
    ),
});

/** Reads only the audio cleanup fields from the singleton checkpoint. */
export const checkpoint = internalQuery({
  args: {},
  returns: checkpointValidator,
  handler: (ctx) => runConvexProgram(readAudioCheckpoint(ctx)),
});

/** Persists the immutable terminal journal inventory exactly once. */
export const recordAudit = internalMutation({
  args: { audit: audioWorkflowAuditValidator },
  returns: v.null(),
  handler: (ctx, args) =>
    runConvexProgram(recordAudioAudit(ctx, args.audit).pipe(Effect.as(null))),
});

/** Marks cleanup complete only after the action observes an empty journal. */
export const recordCleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: (ctx) =>
    runConvexProgram(recordAudioCleanup(ctx).pipe(Effect.as(null))),
});

/** Reads the durable audit without exposing unrelated cutover fields. */
const readAudioCheckpoint = Effect.fn(
  "contentRelease.cutover.readAudioCheckpoint"
)(function* (ctx: QueryCtx) {
  const state = yield* requireCutoverPhase(ctx, [
    "quiescent",
    "audited",
    "draining-legacy",
    "legacy-drained",
    "freeze-armed",
    "frozen",
    "draining-current",
    "complete",
    "proved",
  ]);
  return {
    audit: state.audioWorkflowAudit,
    auditedAt: state.audioWorkflowAuditedAt,
    cleanedAt: state.audioWorkflowCleanedAt,
  };
});

/** Commits the exact audit or proves an idempotent retry matches it. */
const recordAudioAudit = Effect.fn("contentRelease.cutover.recordAudioAudit")(
  function* (ctx: MutationCtx, auditReceipt: AudioWorkflowAudit) {
    const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
    yield* validateAudioWorkflowAudit(auditReceipt);
    const existing = state.audioWorkflowAudit;
    if (existing) {
      if (!sameAudioAudit(existing, auditReceipt)) {
        return yield* audioFailure(
          "The durable audio workflow audit differs from this retry."
        );
      }
      return;
    }
    const now = Date.now();
    yield* Effect.promise(() =>
      ctx.db.patch("contentCutoverState", state._id, {
        audioWorkflowAudit: auditReceipt,
        audioWorkflowAuditedAt: now,
        updatedAt: now,
      })
    );
  }
);

/** Commits the terminal empty-journal marker exactly once. */
const recordAudioCleanup = Effect.fn(
  "contentRelease.cutover.recordAudioCleanup"
)(function* (ctx: MutationCtx) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  const auditReceipt = state.audioWorkflowAudit;
  if (!auditReceipt) {
    return yield* audioFailure(
      "The terminal audio workflow inventory has not been audited."
    );
  }
  yield* validateAudioWorkflowAudit(auditReceipt);
  if (state.audioWorkflowCleanedAt !== undefined) {
    return;
  }
  const now = Date.now();
  yield* Effect.promise(() =>
    ctx.db.patch("contentCutoverState", state._id, {
      audioWorkflowCleanedAt: now,
      updatedAt: now,
    })
  );
});

function sameAudioAudit(left: AudioWorkflowAudit, right: AudioWorkflowAudit) {
  return (
    left.failed === right.failed &&
    left.steps === right.steps &&
    left.succeeded === right.succeeded &&
    left.total === right.total &&
    left.workflows.length === right.workflows.length &&
    left.workflows.every((row, index) => {
      const candidate = right.workflows.at(index);
      return (
        candidate?.id === row.id &&
        candidate.result === row.result &&
        candidate.steps === row.steps
      );
    })
  );
}

function audioFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Audio workflow cutover: ${message}`
  );
}
